// 이 파일이 하는 일: 같은 해변 실시간(C단계)의 통신 담당 — 정해 둔 숫자들, 받은 메시지를 믿지 않고 검사하는 함수, 보내는 횟수 제한, 한 사람이 너무 많이 보낼 때 잠깐 무시하기
import { clampToBeach } from '../scene/world.js';
import { EMOTES } from '../character/animations.js';
import { validateNickname } from '../state/nickname.js';
import { normalizeLook } from '../state/profile.js';

// ---------- 정해 둔 숫자(스펙 그대로) ----------
export const MOVE_INTERVAL_MS = 500;      // 위치는 0.5초에 한 번까지
export const CHAT_INTERVAL_MS = 2000;     // 채팅은 2초에 한 번까지
export const HERE_IDLE_MS = 10000;        // 10초 동안 보낸 게 없으면 "아직 있어요"
export const STALE_MS = 30000;            // 30초 소식 없으면 지운다
export const MAX_VISIBLE = 30;            // 동시에 그리는 사람 수
export const CHAT_MAX = 30;               // 채팅 글자 수
export const BUBBLE_MS = 5000;            // 말풍선이 떠 있는 시간
export const FLOOD_MAX = 20;              // 한 사람이 1초에 이보다 많이 보내면
export const FLOOD_MUTE_MS = 3000;        // 3초 동안 무시
export const RECONNECT_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000];
export const MODES = ['move', 'play', 'zen'];

// ---------- 받은 메시지 검사 ----------
// 다른 사람의 앱이 무엇을 보낼지는 알 수 없다. 모양이 맞는 것만 새 객체로 옮겨 담고, 아니면 null(버림)
const SID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSid = v => typeof v === 'string' && SID_RE.test(v);
const num = v => typeof v === 'number' && Number.isFinite(v);
const obj = v => v && typeof v === 'object';

export function parseMove(raw) {
  if (!obj(raw) || !isSid(raw.sid) || !num(raw.x) || !num(raw.z) || !num(raw.ry)) return null;
  const p = clampToBeach({ x: raw.x, z: raw.z });   // 해변 밖이면 안쪽으로 당긴다
  return { sid: raw.sid, x: p.x, z: p.z, ry: raw.ry };
}

export function parseEmote(raw) {
  if (!obj(raw) || !isSid(raw.sid) || typeof raw.name !== 'string') return null;
  if (!Object.prototype.hasOwnProperty.call(EMOTES, raw.name)) return null;   // '__proto__'·'toString' 같은 이름은 막는다
  return { sid: raw.sid, name: raw.name };
}

export function parseChat(raw) {
  if (!obj(raw) || !isSid(raw.sid) || typeof raw.text !== 'string') return null;
  const text = [...raw.text.trim()].slice(0, CHAT_MAX).join('');   // 한글·이모지도 '글자' 단위로 자른다
  return text ? { sid: raw.sid, text } : null;
}

export function parsePresence(raw) {
  if (!obj(raw) || !isSid(raw.sid) || !num(raw.x) || !num(raw.z)) return null;
  const n = validateNickname(raw.nick);
  const p = clampToBeach({ x: raw.x, z: raw.z });
  return {
    sid: raw.sid,
    nick: n.ok ? n.value : '손님',
    look: normalizeLook(raw.look),
    x: p.x, z: p.z,
    ry: num(raw.ry) ? raw.ry : 0,
    mode: MODES.includes(raw.mode) ? raw.mode : 'move'
  };
}

// ---------- 보내는 횟수 제한 ----------
export function createLimiter(intervalMs) {
  let last = -Infinity;
  return {
    ready: now => now - last >= intervalMs,
    mark: now => { last = now; }
  };
}

// ---------- 폭주 무시: 한 사람이 1초에 max개 넘게 보내면 muteMs 동안 그 사람 메시지를 버린다 ----------
export function createFloodGuard({ max = FLOOD_MAX, windowMs = 1000, muteMs = FLOOD_MUTE_MS } = {}) {
  const seen = new Map();   // sid → { times: number[], mutedUntil }
  return {
    allow(sid, now) {
      let s = seen.get(sid);
      if (!s) { s = { times: [], mutedUntil: -Infinity }; seen.set(sid, s); }
      if (now < s.mutedUntil) return false;
      s.times = s.times.filter(t => now - t < windowMs);
      s.times.push(now);
      if (s.times.length > max) { s.mutedUntil = now + muteMs; s.times = []; return false; }
      return true;
    }
  };
}

// ---------- 연결 관리자 ----------
// 어댑터(진짜 Supabase 또는 테스트용 가짜)를 받아서: 연결·재연결, 내 상태 올리기, 보내기 횟수 제한, 받은 메시지 검사를 맡는다
const STATE_KEYS = ['sid', 'nick', 'look', 'x', 'z', 'ry', 'mode'];
const PARSE = { move: parseMove, emote: parseEmote, chat: parseChat, here: raw => (obj(raw) && isSid(raw.sid) ? { sid: raw.sid } : null) };

export function createRealtime({ sid, transport, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout }) {
  const listeners = {};
  const emit = (ev, v) => { for (const fn of listeners[ev] ?? []) fn(v); };
  const moveLimit = createLimiter(MOVE_INTERVAL_MS), chatLimit = createLimiter(CHAT_INTERVAL_MS);
  const flood = createFloodGuard();
  let known = new Set(), state = null, stopped = true, attempt = 0, timer = null, lastSent = -Infinity;

  const rt = {
    status: 'idle',
    on(ev, fn) { (listeners[ev] ??= []).push(fn); return rt; },
    start() {
      if (!stopped) return;
      stopped = false;
      connect();
    },
    stop() {
      stopped = true;
      if (timer) { clearTimer(timer); timer = null; }
      transport.disconnect();
      known = new Set();
      setStatus('idle');
    },
    setState(s) {
      state = {};
      for (const k of STATE_KEYS) state[k] = s[k];   // 허용한 칸만(기기 열쇠 같은 건 절대 안 실린다)
      state.sid = sid;
      if (rt.status === 'online') track();
    },
    sendMove({ x, z, ry }) {
      const t = now();
      if (rt.status !== 'online' || !moveLimit.ready(t)) return false;
      moveLimit.mark(t); lastSent = t;
      transport.send('move', { sid, x, z, ry });
      return true;
    },
    sendEmote(name) {
      if (rt.status !== 'online') return false;
      lastSent = now();
      transport.send('emote', { sid, name });
      return true;
    },
    async sendChat(text) {
      const t = now();
      if (rt.status !== 'online') return 'failed';
      if (!chatLimit.ready(t)) return 'limited';
      chatLimit.mark(t); lastSent = t;
      return (await transport.send('chat', { sid, text })) ? 'ok' : 'failed';
    },
    tickIdle() {
      const t = now();
      if (rt.status !== 'online' || t - lastSent < HERE_IDLE_MS) return;
      lastSent = t;
      transport.send('here', { sid });
    }
  };

  function setStatus(s) { if (rt.status !== s) { rt.status = s; emit('status', s); } }
  function track() { lastSent = now(); transport.track(state); }
  function connect() {
    setStatus(rt.status === 'offline' ? 'offline' : 'connecting');
    transport.connect({ sid, onPresence, onLeave, onBroadcast, onStatus });
  }
  function onStatus(s) {
    if (stopped) return;
    if (s === 'online') {
      attempt = 0;
      if (timer) { clearTimer(timer); timer = null; }
      lastSent = now();   // 연결된 순간부터 '10초 조용함'을 센다
      setStatus('online');
      if (state) track();   // 다시 붙으면 내 상태를 다시 알린다
      return;
    }
    setStatus('offline');
    if (timer) return;
    const delay = RECONNECT_STEPS_MS[Math.min(attempt, RECONNECT_STEPS_MS.length - 1)];
    attempt++;
    timer = setTimer(() => { timer = null; if (stopped) return; transport.disconnect(); connect(); }, delay);
  }
  function onPresence(list) {
    const people = (Array.isArray(list) ? list : []).map(parsePresence).filter(p => p && p.sid !== sid);
    known = new Set(people.map(p => p.sid));
    emit('presence', people);
  }
  function onLeave(s) {
    if (!isSid(s) || s === sid) return;
    known.delete(s);
    emit('leave', s);
  }
  function onBroadcast(event, payload) {
    const parse = PARSE[event];
    if (!parse) return;
    const m = parse(payload);
    if (!m || m.sid === sid || !known.has(m.sid)) return;   // 내 것·모르는 사람 것은 버린다
    if (!flood.allow(m.sid, now())) return;
    emit(event, m);
  }
  return rt;
}

// ---------- 진짜 어댑터: Supabase Realtime (전역 supabase = vendor/supabase/supabase.js) ----------
export function supabaseTransport({ url, key, lib = globalThis.supabase }) {
  let client = null, ch = null, online = false, gen = 0;
  const makeClient = () => lib.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return {
    connect(h) {
      const my = ++gen;   // 이번 연결의 번호. 옛 연결에서 늦게 온 소식은 번호가 달라 무시된다
      // 같은 클라이언트에선 떠나는 중인 옛 'beach' 채널이 (서버 답이나 10초 시간 초과까지) 그대로 돌아오고
      // subscribe도 동작하지 않는다(supabase-js 2.118.0). 그래서 다시 붙을 때마다 새 클라이언트(새 연결)를 쓴다
      client = makeClient();
      const mine = client.channel('beach', { config: { presence: { key: h.sid }, broadcast: { self: false } } });
      ch = mine;
      mine
        .on('presence', { event: 'sync' }, () => { if (my === gen) h.onPresence(Object.values(mine.presenceState()).map(metas => metas[0]).filter(Boolean)); })
        // 같은 사람이 상태를 바꿔 다시 track하면 '옛 상태 leave → 새 상태 join'이 온다. 남은 상태가 없을 때만 진짜 떠남
        .on('presence', { event: 'leave' }, ({ key: k, currentPresences }) => { if (my === gen && !currentPresences?.length) h.onLeave(k); })
        .on('broadcast', { event: '*' }, ({ event, payload }) => { if (my === gen) h.onBroadcast(event, payload); })
        .subscribe(status => {
          if (my !== gen) return;   // 이미 버린 연결의 소식(늦은 CLOSED 등)은 무시
          online = status === 'SUBSCRIBED';
          h.onStatus(online ? 'online' : 'offline');
        });
    },
    async track(state) { if (ch && online) { try { await ch.track(state); } catch { /* 다음 연결 때 다시 */ } } },
    // 연결이 없을 때 send()는 조용히 일반 웹 요청으로 바꿔 보내므로, 끊김을 숨기지 않게 연결됐을 때만 보낸다
    async send(event, payload) {
      if (!ch || !online) return false;
      try { return (await ch.send({ type: 'broadcast', event, payload })) === 'ok'; } catch { return false; }
    },
    disconnect() {
      gen++; online = false;
      const old = client; client = null; ch = null;
      if (old) old.removeAllChannels().catch(() => {});   // 떠난다고 알리고 옛 연결을 닫는다(기다리지 않음)
    }
  };
}

// ---------- 가짜 어댑터: 같은 브라우저의 창끼리 BroadcastChannel로 잇는다(테스트용) ----------
export function fakeTransport(name = 'sr-fake-rt') {
  const members = new Map();   // sid → state(다른 사람들)
  let bc = null, h = null, mySid = null, myState = null, connected = false, silenced = false, failNext = 0;
  const sent = (globalThis.__rtSent ??= []);
  const post = msg => { if (!bc || silenced) return; sent.push(msg); bc.postMessage(msg); };
  const list = () => [...members.values(), ...(myState ? [myState] : [])];
  const api = {
    connect(handlers) {
      h = handlers; mySid = handlers.sid;
      if (failNext > 0) { failNext--; setTimeout(() => h.onStatus('offline'), 0); return; }
      bc = new BroadcastChannel(name);
      bc.onmessage = ({ data: m }) => {
        if (!connected || silenced || !m || m.sid === mySid) return;
        if (m.t === 'track') {
          const isNew = !members.has(m.sid);
          members.set(m.sid, m.state);
          h.onPresence(list());
          if (isNew && myState) post({ t: 'track', sid: mySid, state: myState });   // 새로 온 사람에게 나를 알린다
        } else if (m.t === 'hello') {
          if (myState) post({ t: 'track', sid: mySid, state: myState });   // 새로 붙은 사람에게 나를 알린다(진짜 서버가 접속 목록 전체를 주는 것 흉내)
        } else if (m.t === 'leave') {
          members.delete(m.sid); h.onLeave(m.sid); h.onPresence(list());
        } else if (m.t === 'bc') h.onBroadcast(m.event, m.payload);
      };
      connected = true;
      post({ t: 'hello', sid: mySid });
      setTimeout(() => { if (connected) h.onStatus('online'); }, 0);
    },
    async track(state) { myState = state; if (connected) { post({ t: 'track', sid: mySid, state }); h.onPresence(list()); } },
    async send(event, payload) { if (!connected || silenced) return false; post({ t: 'bc', event, payload }); return true; },
    disconnect() {
      if (connected) post({ t: 'leave', sid: mySid });
      connected = false; members.clear();
      bc?.close(); bc = null;
    }
  };
  // 테스트가 사고를 흉내 내는 손잡이
  globalThis.__rtFake = {
    failNext(n = 1) { failNext = n; },
    drop() { connected = false; bc?.close(); bc = null; members.clear(); h?.onStatus('offline'); },   // 인사 없이 끊김
    silence() { silenced = true; },
    raw(event, payload) { if (bc && !silenced) post({ t: 'bc', event, payload }); },   // 검사 없이 아무 값이나 보내 보기
    rawTrack(state) { if (bc && !silenced) post({ t: 'track', sid: state?.sid, state }); },   // 다른 사람인 척 접속 상태 보내 보기
    get members() { return members.size; }
  };
  return api;
}
