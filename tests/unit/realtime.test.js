// 이 파일이 하는 일: 실시간으로 받은 메시지를 믿지 않고 검사하는 함수들과, 보내는 횟수를 제한하는 장치를 확인
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isSid, parseMove, parseEmote, parseChat, parsePresence, createLimiter, createFloodGuard,
  MOVE_INTERVAL_MS, CHAT_INTERVAL_MS, HERE_IDLE_MS, STALE_MS, MAX_VISIBLE, CHAT_MAX, BUBBLE_MS, FLOOD_MAX, FLOOD_MUTE_MS, RECONNECT_STEPS_MS
} from '../../src/net/realtime.js';
import { normalizeLook } from '../../src/state/profile.js';

const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
const SID2 = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

test('상수는 스펙 값 그대로', () => {
  assert.equal(MOVE_INTERVAL_MS, 500); assert.equal(CHAT_INTERVAL_MS, 2000); assert.equal(HERE_IDLE_MS, 10000);
  assert.equal(STALE_MS, 30000); assert.equal(MAX_VISIBLE, 30); assert.equal(CHAT_MAX, 30); assert.equal(BUBBLE_MS, 5000);
  assert.equal(FLOOD_MAX, 20); assert.equal(FLOOD_MUTE_MS, 3000);
  assert.deepEqual(RECONNECT_STEPS_MS, [1000, 2000, 4000, 8000, 16000, 30000]);
});

test('isSid: UUID 모양만', () => {
  assert.equal(isSid(SID), true);
  assert.equal(isSid('abc'), false);
  assert.equal(isSid(123), false);
  assert.equal(isSid(SID + 'x'), false);
});

test('parseMove: x 99 → 30으로, z -99 → -12로(BOUNDS)', () => {
  assert.deepEqual(parseMove({ sid: SID, x: 99, z: -99, ry: 1 }), { sid: SID, x: 30, z: -12, ry: 1 });
});

test('parseMove: NaN·문자열·Infinity → null', () => {
  assert.equal(parseMove({ sid: SID, x: NaN, z: 0, ry: 0 }), null);
  assert.equal(parseMove({ sid: SID, x: '1', z: 0, ry: 0 }), null);
  assert.equal(parseMove({ sid: SID, x: 0, z: Infinity, ry: 0 }), null);
  assert.equal(parseMove({ sid: SID, x: 0, z: 0, ry: NaN }), null);
  assert.equal(parseMove(null), null);
});

test("parseMove: sid가 'abc'면 null", () => {
  assert.equal(parseMove({ sid: 'abc', x: 0, z: 0, ry: 0 }), null);
});

test("parseEmote: 'cheers' 통과, 'explode' null, '__proto__' null", () => {
  assert.deepEqual(parseEmote({ sid: SID, name: 'cheers' }), { sid: SID, name: 'cheers' });
  assert.equal(parseEmote({ sid: SID, name: 'explode' }), null);
  assert.equal(parseEmote({ sid: SID, name: '__proto__' }), null);
  assert.equal(parseEmote({ sid: SID, name: 'toString' }), null);
});

test("parseChat: 앞뒤 공백 제거, 31자 → 앞 30자, 빈 글·숫자는 null", () => {
  assert.deepEqual(parseChat({ sid: SID, text: '  안녕  ' }), { sid: SID, text: '안녕' });
  assert.equal(parseChat({ sid: SID, text: '가'.repeat(31) }).text, '가'.repeat(30));
  assert.equal(parseChat({ sid: SID, text: '   ' }), null);
  assert.equal(parseChat({ sid: SID, text: 123 }), null);
});

test("parsePresence: 이상한 닉네임은 '손님', look 정리, mode 정리, token 같은 다른 필드는 버린다", () => {
  const p = parsePresence({ sid: SID, nick: '<b>x</b>', look: { hat: 'crown', shirt: 99 }, x: 1, z: 2, ry: 0.5, mode: 'fly', token: 'secret', presence_ref: 'r' });
  assert.deepEqual(p, { sid: SID, nick: '손님', look: normalizeLook({ hat: 'crown', shirt: 99 }), x: 1, z: 2, ry: 0.5, mode: 'move' });
  assert.equal(JSON.stringify(p).includes('secret'), false);
  assert.equal(parsePresence({ sid: SID, nick: '세민', look: {}, x: 1, z: 2, ry: 0, mode: 'zen' }).mode, 'zen');
  assert.equal(parsePresence({ sid: SID, nick: '세민', look: {}, x: 1, z: 2, ry: 'a', mode: 'play' }).ry, 0);
  assert.equal(parsePresence({ sid: SID, nick: '세민', look: {}, x: NaN, z: 2, ry: 0, mode: 'play' }), null);
  assert.equal(parsePresence({ sid: 'nope', nick: '세민', look: {}, x: 1, z: 2 }), null);
});

test('createLimiter(500): 0에 준비 → mark → 499엔 아직 → 500에 준비', () => {
  const l = createLimiter(500);
  assert.equal(l.ready(0), true);
  l.mark(0);
  assert.equal(l.ready(499), false);
  assert.equal(l.ready(500), true);
});

test('createFloodGuard: 같은 sid 20번 허용, 21번째 막고, 3초 뒤 다시 허용, 다른 sid는 영향 없음', () => {
  const g = createFloodGuard();
  for (let i = 0; i < 20; i++) assert.equal(g.allow(SID, 100 + i), true);
  assert.equal(g.allow(SID, 130), false);
  assert.equal(g.allow(SID2, 131), true);
  assert.equal(g.allow(SID, 2000), false);          // 막힌 지 3초가 안 됨
  assert.equal(g.allow(SID, 130 + 3001), true);
});

// ---------- 연결 관리자(createRealtime) ----------
import { createRealtime, fakeTransport } from '../../src/net/realtime.js';

// 메모리 어댑터: 앱이 부른 것을 기록하고, 테스트가 서버 쪽 사건(online·presence·broadcast)을 일으킨다
function memTransport() {
  const t = { connects: 0, disconnects: 0, tracked: [], sent: [], sendOk: true, h: null };
  t.connect = handlers => { t.connects++; t.h = handlers; };
  t.track = async state => { t.tracked.push(state); };
  t.send = async (event, payload) => { t.sent.push({ event, payload }); return t.sendOk; };
  t.disconnect = () => { t.disconnects++; };
  return t;
}
function fakeTimers() {
  let now = 0; const q = [];
  return {
    now: () => now,
    setTimer: (fn, ms) => { const id = { fn, at: now + ms }; q.push(id); return id; },
    clearTimer: id => { const i = q.indexOf(id); if (i >= 0) q.splice(i, 1); },
    advance(ms) { now += ms; for (const t of [...q].sort((a, b) => a.at - b.at)) if (t.at <= now) { q.splice(q.indexOf(t), 1); t.fn(); } }
  };
}
const ME = SID;
const STATE = { sid: ME, nick: '세민', look: { hat: 'straw', glasses: true, shirt: 0, cocktail: 0 }, x: 0, z: 5, ry: 0, mode: 'move' };

test('start → connect, online이 되면 status online이고 저장된 state를 track한다', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  rt.setState(STATE);
  rt.start();
  assert.equal(t.connects, 1);
  assert.equal(rt.status, 'connecting');
  t.h.onStatus('online');
  assert.equal(rt.status, 'online');
  assert.deepEqual(t.tracked.at(-1), STATE);
});

test('끊기면 1000·2000·4000ms 간격으로 다시 연결하고, online이 되면 간격은 처음부터', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  rt.start(); t.h.onStatus('offline');
  assert.equal(rt.status, 'offline');
  c.advance(999); assert.equal(t.connects, 1);
  c.advance(1); assert.equal(t.connects, 2);
  t.h.onStatus('offline'); c.advance(1999); assert.equal(t.connects, 2); c.advance(1); assert.equal(t.connects, 3);
  t.h.onStatus('offline'); c.advance(4000); assert.equal(t.connects, 4);
  t.h.onStatus('online'); t.h.onStatus('offline'); c.advance(1000); assert.equal(t.connects, 5);
});

test('간격 끝(30000)에 닿으면 그 뒤로는 30000 반복', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  rt.start();
  for (const ms of [1000, 2000, 4000, 8000, 16000, 30000, 30000]) { t.h.onStatus('offline'); const before = t.connects; c.advance(ms); assert.equal(t.connects, before + 1, `after ${ms}`); }
});

test('stop하면 다시 연결하지 않는다', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  rt.start(); t.h.onStatus('offline'); rt.stop();
  c.advance(60000);
  assert.equal(t.connects, 1);
  assert.equal(t.disconnects >= 1, true);
  assert.equal(rt.status, 'idle');
});

test('sendMove는 500ms 안에 두 번 부르면 두 번째 false, 연결 전엔 false', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  assert.equal(rt.sendMove({ x: 1, z: 2, ry: 0 }), false);
  rt.start(); t.h.onStatus('online');
  assert.equal(rt.sendMove({ x: 1, z: 2, ry: 0 }), true);
  c.advance(499); assert.equal(rt.sendMove({ x: 1, z: 3, ry: 0 }), false);
  c.advance(1); assert.equal(rt.sendMove({ x: 1, z: 3, ry: 0 }), true);
  assert.deepEqual(t.sent.map(s => s.event), ['move', 'move']);
  assert.deepEqual(t.sent[0].payload, { sid: ME, x: 1, z: 2, ry: 0 });
});

test("sendChat: 2초 안 두 번째는 'limited', 어댑터가 실패하면 'failed', 연결 전엔 'failed'", async () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  assert.equal(await rt.sendChat('안녕'), 'failed');
  rt.start(); t.h.onStatus('online');
  assert.equal(await rt.sendChat('안녕'), 'ok');
  assert.equal(await rt.sendChat('또'), 'limited');
  c.advance(2000); t.sendOk = false;
  assert.equal(await rt.sendChat('또'), 'failed');
  assert.deepEqual(t.sent.filter(s => s.event === 'chat').map(s => s.payload.text), ['안녕', '또']);
});

test('받은 move: 내 sid는 무시, presence에 없는 sid는 무시, 있으면 검사한 결과로 알린다', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  const got = []; rt.on('move', m => got.push(m));
  const pres = []; rt.on('presence', l => pres.push(l));
  rt.start(); t.h.onStatus('online');
  t.h.onBroadcast('move', { sid: SID2, x: 1, z: 2, ry: 0 });            // 아직 presence에 없음
  t.h.onPresence([{ ...STATE }, { ...STATE, sid: SID2, nick: '친구' }]);   // 나 + 친구
  assert.deepEqual(pres.at(-1).map(p => p.sid), [SID2]);                 // 목록에서 나는 빠진다
  t.h.onBroadcast('move', { sid: ME, x: 1, z: 2, ry: 0 });
  t.h.onBroadcast('move', { sid: SID2, x: 999, z: 2, ry: 0 });
  t.h.onBroadcast('move', { sid: SID2, x: NaN, z: 2, ry: 0 });
  assert.deepEqual(got, [{ sid: SID2, x: 30, z: 2, ry: 0 }]);
});

test('같은 sid가 1초에 20개 넘게 보내면 그 sid는 잠깐 무시', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  let n = 0; rt.on('here', () => n++);
  rt.start(); t.h.onStatus('online'); t.h.onPresence([{ ...STATE, sid: SID2 }]);
  for (let i = 0; i < 25; i++) t.h.onBroadcast('here', { sid: SID2 });
  assert.equal(n, 20);
});

test('tickIdle: 마지막으로 보낸 지 10000ms면 here 1번, 그 전엔 0번', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  rt.start(); t.h.onStatus('online');     // online 때 track → 마지막 보낸 시각 0
  c.advance(9999); rt.tickIdle(); assert.equal(t.sent.filter(s => s.event === 'here').length, 0);
  c.advance(1); rt.tickIdle(); rt.tickIdle();
  assert.deepEqual(t.sent.filter(s => s.event === 'here').map(s => s.payload), [{ sid: ME }]);
});

test('setState는 허용된 칸만 보낸다(기기 열쇠가 실리지 않는다)', () => {
  const t = memTransport(), c = fakeTimers();
  const rt = createRealtime({ sid: ME, transport: t, now: c.now, setTimer: c.setTimer, clearTimer: c.clearTimer });
  rt.start(); t.h.onStatus('online');
  rt.setState({ ...STATE, token: '11111111-2222-4333-8444-555555555555', bottles: [1] });
  rt.sendMove({ x: 1, z: 1, ry: 0, token: 'x' });
  const all = JSON.stringify([t.tracked, t.sent]);
  assert.equal(all.includes('11111111-2222'), false);
  assert.deepEqual(Object.keys(t.tracked.at(-1)).sort(), ['look', 'mode', 'nick', 'ry', 'sid', 'x', 'z']);
});

test('가짜 어댑터 둘: track과 broadcast가 서로 전해지고, 새로 온 쪽도 먼저 있던 쪽을 알게 된다', async () => {
  const name = 'test-' + Math.random();
  const a = fakeTransport(name), b = fakeTransport(name);
  const ga = [], gb = [];
  a.connect({ sid: ME, onPresence: l => ga.push(l), onLeave() {}, onBroadcast() {}, onStatus() {} });
  await new Promise(r => setTimeout(r, 20));
  await a.track({ ...STATE });
  b.connect({ sid: SID2, onPresence: l => gb.push(l), onLeave() {}, onBroadcast: (e, p) => gb.push({ e, p }), onStatus() {} });
  await new Promise(r => setTimeout(r, 20));
  await b.track({ ...STATE, sid: SID2 });
  await new Promise(r => setTimeout(r, 50));
  assert.ok(ga.at(-1).some(s => s.sid === SID2), 'a가 b를 안다');
  assert.ok(gb.filter(Array.isArray).at(-1).some(s => s.sid === ME), 'b가 먼저 있던 a를 안다');
  await a.send('move', { sid: ME, x: 1, z: 2, ry: 0 });
  await new Promise(r => setTimeout(r, 30));
  assert.ok(gb.some(g => g.e === 'move' && g.p.x === 1));
  a.disconnect(); b.disconnect();
});

// ---------- 진짜 어댑터(supabaseTransport)를 벤더 라이브러리와 같은 규칙의 흉내 lib로 ----------
// supabase-js 2.118.0에서 확인한 규칙: channel(name)은 같은 이름이 목록에 남아 있으면 그 채널을 그대로 준다,
// subscribe는 닫힌 채널에서만 동작, removeChannel은 서버 답(또는 10초 시간 초과) 뒤에야 목록에서 빠진다,
// 같은 key로 다시 track하면 leave(남은 currentPresences 있음) → join이 온다
import { supabaseTransport } from '../../src/net/realtime.js';
function stubLib() {
  const lib = { clients: [] };
  lib.createClient = () => {
    const client = { channels: [], removals: [] };
    client.getChannels = () => client.channels;
    client.channel = name => {
      const topic = 'realtime:' + name;
      const found = client.channels.find(c => c.topic === topic);
      if (found) return found;
      const ch = { topic, state: 'closed', bindings: [], subs: [] };
      ch.on = (type, filter, cb) => { ch.bindings.push({ type, event: filter.event, cb }); return ch; };
      ch.subscribe = cb => { ch.subs.push(cb); if (ch.state === 'closed') { ch.state = 'joining'; queueMicrotask(() => { ch.state = 'joined'; cb('SUBSCRIBED'); }); } return ch; };
      ch.presenceState = () => ({});
      ch.track = async () => 'ok';
      ch.send = async () => 'ok';
      ch.fire = (type, event, payload) => ch.bindings.filter(b => b.type === type && (b.event === event || b.event === '*')).forEach(b => b.cb(payload));
      client.channels.push(ch);
      return ch;
    };
    // 서버 답이 올 때까지 목록에 남는다(테스트가 finish()로 답을 준다)
    client.removeChannel = ch => new Promise(res => { ch.state = 'leaving'; client.removals.push(() => { client.channels = client.channels.filter(c => c !== ch); ch.state = 'closed'; ch.subs.forEach(s => s('CLOSED')); res('ok'); }); });
    client.removeAllChannels = async () => { for (const c of [...client.channels]) client.removeChannel(c); return []; };
    lib.clients.push(client);
    return client;
  };
  return lib;
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('진짜 어댑터: 같은 사람이 상태를 바꿔 다시 track해서 생긴 leave는 떠남이 아니다', async () => {
  const lib = stubLib();
  const t = supabaseTransport({ url: 'u', key: 'k', lib });
  const left = [];
  t.connect({ sid: ME, onPresence() {}, onLeave: k => left.push(k), onBroadcast() {}, onStatus() {} });
  await tick();
  const ch = lib.clients.at(-1).channels[0];
  ch.fire('presence', 'leave', { event: 'leave', key: SID2, currentPresences: [{ nick: '새 상태' }], leftPresences: [{ nick: '옛 상태' }] });
  assert.deepEqual(left, []);
  ch.fire('presence', 'leave', { event: 'leave', key: SID2, currentPresences: [], leftPresences: [{ nick: '옛 상태' }] });
  assert.deepEqual(left, [SID2]);
});

test('진짜 어댑터: 숨김→보임이 빠르면(옛 채널이 아직 떠나는 중) 새 채널로 바로 다시 붙고, 옛 채널의 늦은 CLOSED는 무시', async () => {
  const lib = stubLib();
  const t = supabaseTransport({ url: 'u', key: 'k', lib });
  const statuses = [];
  const h = { sid: ME, onPresence() {}, onLeave() {}, onBroadcast() {}, onStatus: s => statuses.push(s) };
  t.connect(h); await tick();
  assert.deepEqual(statuses, ['online']);
  t.disconnect();            // 떠나기 요청(서버 답은 아직)
  t.connect(h); await tick();  // 곧바로 다시
  assert.deepEqual(statuses, ['online', 'online'], '다시 연결되어야 한다');
  for (const c of lib.clients) for (const f of c.removals) f();   // 이제야 옛 채널 서버 답 도착 → CLOSED
  await tick();
  assert.deepEqual(statuses, ['online', 'online'], '늦게 온 CLOSED로 끊김 처리하면 안 된다');
});
