// 이 파일이 하는 일: 같은 해변의 다른 사람들 — 실시간으로 받은 접속 목록·위치·동작으로 캐릭터를 만들고 움직이고 지우며, 내 위치·동작·꾸미기를 보내고, 인원 칩과 연결 배지를 맞춘다
import { buildAvatar } from '../character/avatar.js';
import { AnimationController } from '../character/animations.js';
import { makeLabel } from '../scene/labels.js';
import { createRealtime, supabaseTransport, fakeTransport, STALE_MS, MAX_VISIBLE, BUBBLE_MS } from '../net/realtime.js';
import { renderChat } from '../ui/chat.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../net/config.js';

// ---------- 순수 계산(단위 테스트) ----------
// 목표점 쪽으로 부드럽게: 0.5초에 남은 거리의 약 90%를 간다
export function stepToward(cur, target, dt) {
  const k = 1 - Math.exp(-dt * 4.62);   // e^(-0.5×4.62) ≈ 0.099 → 0.5초에 90% 넘게
  return { x: cur.x + (target.x - cur.x) * k, z: cur.z + (target.z - cur.z) * k };
}
export function staleSids(people, now, ms = STALE_MS) {
  return [...people].filter(([, p]) => now - p.lastSeen >= ms).map(([sid]) => sid);
}
export function nearestSids(people, me, n = MAX_VISIBLE) {
  return new Set([...people]
    .map(([sid, p]) => [sid, (p.pos.x - me.x) ** 2 + (p.pos.z - me.z) ** 2])
    .sort((a, b) => a[1] - b[1]).slice(0, n).map(([sid]) => sid));
}

// 지운 캐릭터의 도형·재질을 GPU에서 내려 준다(안 하면 사람이 들락날락할 때마다 폰 메모리가 계속 는다)
export function disposeAvatar(group) {
  group.traverse(o => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) m?.dispose();
  });
}

// 일회용 번호: 앱을 열 때마다 새로(기기 열쇠와는 전혀 상관없음)
function newSid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

function chooseTransport() {
  const mode = globalThis.__SR_RT__;
  if (mode === 'off') return 'off';
  if (mode === 'fake') return fakeTransport();
  if (!globalThis.supabase?.createClient) return null;   // 라이브러리를 못 불러옴
  return supabaseTransport({ url: SUPABASE_URL, key: SUPABASE_KEY });
}

const LABEL_Y = 2.25;
const modeOf = m => (m === 'zen' ? 'zen' : m === 'play' ? 'play' : 'move');

export function setupPeople(app, { scene, player, profile, effects, getHud, hudRoot, now = () => Date.now() }) {
  const sid = newSid();
  app.sid = sid;
  const people = new Map();   // sid → { sid, nick, look, mode, avatar, anim, pos, target, ry, lastSeen, label }
  const transport = chooseTransport();
  const realtime = transport && transport !== 'off'
    ? createRealtime({ sid, transport })
    : { status: transport === 'off' ? 'idle' : 'disabled', on() { return this; }, start() {}, stop() {}, setState() {}, sendMove() { return false; }, sendEmote() {}, sendChat: async () => 'failed', tickIdle() {} };

  // ---------- 캐릭터 만들기·지우기 ----------
  function add(p) {
    const avatar = buildAvatar(p.look);
    avatar.group.traverse(o => { if (o.isMesh) o.castShadow = false; });   // 다른 사람은 그림자 없이(가볍게)
    const anim = new AnimationController(avatar.parts, avatar.group);
    const label = makeLabel(p.nick, 'nick');
    scene.add(avatar.group); scene.add(label);
    const person = { sid: p.sid, nick: p.nick, look: p.look, mode: 'move', avatar, anim, label, pos: { x: p.x, z: p.z }, target: { x: p.x, z: p.z }, ry: p.ry, lastSeen: now() };
    avatar.group.position.set(p.x, 0, p.z);
    people.set(p.sid, person);
    setMode(person, p.mode);
    return person;
  }
  function remove(s) {
    const p = people.get(s);
    if (!p) return;
    scene.remove(p.avatar.group); scene.remove(p.label);
    disposeAvatar(p.avatar.group);
    p.label.userData.dispose();
    clearBubble(p);
    people.delete(s);
  }
  function setMode(p, mode) {
    if (p.mode === mode) return;
    const was = p.mode;
    p.mode = mode;
    if (mode === 'zen') p.anim.play('lie');          // 석양멍: 선베드에 누운 자세
    else if (was === 'zen') p.anim.stop();
  }
  function updateChips() {
    getHud()?.setPeople(realtime.status === 'online' ? people.size + 1 : null);
  }

  // ---------- 말풍선 ----------
  // holder: 다른 사람(person) 또는 나(me). 새 말이 오면 이전 말풍선을 바꾸고, BUBBLE_MS 뒤 지운다
  const me = { bubble: null, bubbleUntil: 0 };
  function setBubble(holder, text) {
    clearBubble(holder);
    holder.bubble = makeLabel(text, 'bubble');
    holder.bubbleUntil = now() + BUBBLE_MS;
    scene.add(holder.bubble);
  }
  function clearBubble(holder) {
    if (!holder.bubble) return;
    scene.remove(holder.bubble); holder.bubble.userData.dispose();
    holder.bubble = null;
  }

  // ---------- 받은 소식 ----------
  realtime
    .on('presence', list => {
      const seen = new Set();
      for (const p of list) {
        seen.add(p.sid);
        let person = people.get(p.sid);
        if (!person) person = add(p);
        else {
          if (person.nick !== p.nick) {   // 닉네임표 다시 그리기
            scene.remove(person.label); person.label.userData.dispose();
            person.label = makeLabel(p.nick, 'nick'); scene.add(person.label);
            person.nick = p.nick;
          }
          if (JSON.stringify(person.look) !== JSON.stringify(p.look)) { person.look = p.look; person.avatar.setLook(p.look); }
          person.target = { x: p.x, z: p.z }; person.ry = p.ry;
          setMode(person, p.mode);
        }
        person.lastSeen = now();
      }
      for (const s of [...people.keys()]) if (!seen.has(s)) remove(s);   // 목록에서 빠진 사람은 지운다
      updateChips();
    })
    .on('leave', s => { remove(s); updateChips(); })
    .on('move', m => { const p = people.get(m.sid); if (!p) return; p.target = { x: m.x, z: m.z }; p.ry = m.ry; p.lastSeen = now(); })
    .on('here', m => { const p = people.get(m.sid); if (p) p.lastSeen = now(); })
    .on('chat', m => { const p = people.get(m.sid); if (!p) return; p.lastSeen = now(); setBubble(p, m.text); })
    .on('emote', m => {
      const p = people.get(m.sid);
      if (!p) return;
      p.lastSeen = now();
      p.anim.play(m.name);
      if (app.quality === 'low') return;   // 느린 폰에선 이펙트 생략(동작은 그대로)
      const g = p.avatar.group.position;
      if (m.name === 'wave' || m.name === 'cheers') effects.spawnHearts({ x: g.x, y: 2.1, z: g.z });
      if (m.name === 'throw') effects.spawnBall({ x: g.x + Math.sin(p.ry) * 0.4, y: 1.4, z: g.z + Math.cos(p.ry) * 0.4 }, p.ry);
    })
    .on('status', s => {
      if (s !== 'online') for (const k of [...people.keys()]) remove(k);   // 끊기면 다시 붙을 때 새 목록으로 맞춘다
      getHud()?.setLinkState(s === 'offline' ? 'offline' : null);
      updateChips();
    });

  // ---------- 내 상태 보내기 ----------
  const myState = () => ({ sid, nick: profile.nickname, look: profile.look, x: player.position.x, z: player.position.z, ry: player.heading, mode: modeOf(app.mode) });
  let lastSentPos = null;
  app.hooks.enter.push(() => {
    if (realtime.status === 'disabled') { getHud()?.setLinkState('disabled'); return; }
    if (transport === 'off') return;
    renderChat(hudRoot, {
      onSend: async text => {
        const r = await realtime.sendChat(text);
        if (r === 'ok') setBubble(me, text);   // 내 머리 위에도
        return r;
      }
    });
    realtime.setState(myState());
    realtime.start();
    const onHide = () => { realtime.stop(); lastSentPos = null; };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
      else { realtime.setState(myState()); realtime.start(); }   // 같은 sid로 다시 들어가므로 상대 화면엔 하나만
    });
    window.addEventListener('pagehide', onHide);
    setInterval(() => { for (const s of staleSids(people, now())) remove(s); updateChips(); }, 1000);
  });
  app.hooks.mode.push(() => realtime.setState(myState()));
  app.hooks.look.push(() => realtime.setState(myState()));
  app.hooks.emote.push(name => realtime.sendEmote(name));

  // ---------- 매 프레임 ----------
  app.frame.push(dt => {
    // 내 위치: 5cm 넘게 움직였거나 0.1rad 넘게 돌았을 때만(0.5초 제한은 realtime이 지킨다). 멈추면 마지막 위치가 한 번 더 나간다
    const pos = { x: player.position.x, z: player.position.z, ry: player.heading };
    if (!lastSentPos || Math.hypot(pos.x - lastSentPos.x, pos.z - lastSentPos.z) >= 0.05 || Math.abs(pos.ry - lastSentPos.ry) >= 0.1) {
      if (realtime.sendMove(pos)) lastSentPos = pos;
    }
    realtime.tickIdle();
    const t = now();
    if (me.bubble) {
      if (t >= me.bubbleUntil) clearBubble(me);
      else me.bubble.position.set(player.position.x, LABEL_Y + 0.15, player.position.z);
    }
    // 다른 사람들: 목표점으로 부드럽게, 가까운 30명만 그린다
    const near = people.size > MAX_VISIBLE ? nearestSids(people, pos) : null;
    for (const p of people.values()) {
      const next = stepToward(p.pos, p.target, dt);
      const moving = p.mode !== 'zen' && Math.hypot(p.target.x - p.pos.x, p.target.z - p.pos.z) > 0.05;
      p.pos = next;
      p.avatar.group.position.x = next.x; p.avatar.group.position.z = next.z;
      p.avatar.group.rotation.y = p.ry;
      if (moving !== p.anim.moving) p.anim.setMoving(moving);
      p.anim.update(dt);
      const show = !near || near.has(p.sid);
      p.avatar.group.visible = show; p.label.visible = show;
      p.label.position.set(next.x, LABEL_Y, next.z);
      if (p.bubble && t >= p.bubbleUntil) clearBubble(p);
      if (p.bubble) { p.bubble.visible = show; p.bubble.position.set(next.x, LABEL_Y + 0.6, next.z); }
    }
  });

  const api = {
    realtime, people, sid,
    count: () => people.size,
    bubbleOf: s => (s === 'me' ? me.bubble : people.get(s)?.bubble)?.userData.text ?? null,
    visibleCount: () => [...people.values()].filter(p => p.avatar.group.visible).length,
    prune(t) { for (const s of staleSids(people, t)) remove(s); updateChips(); }
  };
  app.people = api;
  app.realtime = realtime;
  return api;
}
