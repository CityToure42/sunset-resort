// 이 파일이 하는 일: 브라우저 테스트용 가짜 Supabase. 앱이 서버로 보내는 요청을 가로채(page.route) 메모리에서 처리한다. 규칙은 supabase/migrations/001_b_stage.sql과 똑같이 맞춘다
import { randomUUID } from 'node:crypto';

export const SUPABASE_URL = 'https://xrydrdeyaycijtxulgyw.supabase.co';
const SHAPES = ['round', 'tall', 'square', 'jar', 'heart', 'star'];
const NICK = /^[가-힣A-Za-z0-9 ]{2,10}$/;
const len = s => [...String(s)].length;   // Postgres char_length와 같게 '글자' 수로 센다

export async function installFakeSupabase(page, { bottles = [], failWith = null } = {}) {
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 6, 0, 0, 0) + (tick++) * 1000).toISOString();
  const state = { bottles: [], replies: [], likes: new Set(), reports: new Set(), calls: [] };
  let fail = failWith;
  // 실시간은 테스트가 따로 켜지 않으면 끈다('off'). 켜야 하는 테스트는 이보다 먼저 window.__SR_RT__를 정한다
  await page.addInitScript(() => { window.__SR_RT__ = window.__SR_RT__ ?? 'off'; });

  const addBottle = (partial = {}) => {
    const b = {
      id: partial.id ?? randomUUID(), owner_token: partial.owner_token ?? randomUUID(), nickname: partial.nickname ?? '친구',
      shape: partial.shape ?? 'round', message: partial.message ?? '안녕', x: partial.x ?? 0, z: partial.z ?? -18,
      created_at: partial.created_at ?? stamp(), likes: partial.likes ?? 0, reports: partial.reports ?? 0
    };
    state.bottles.push(b);
    return b;
  };
  const addReply = (bottleId, partial = {}) => {
    const r = { id: randomUUID(), bottle_id: bottleId, author_token: partial.author_token ?? randomUUID(), nickname: partial.nickname ?? '친구', message: partial.message ?? '예쁘다', created_at: partial.created_at ?? stamp() };
    state.replies.push(r);
    return r;
  };
  for (const b of bottles) addBottle(b);

  const bottleJson = (b, token) => ({ id: b.id, nickname: b.nickname, shape: b.shape, message: b.message, x: b.x, z: b.z, created_at: b.created_at, likes: b.likes, is_mine: b.owner_token === token });
  const replyJson = r => ({ id: r.id, nickname: r.nickname, message: r.message, created_at: r.created_at });
  const newest = (a, b) => b.created_at.localeCompare(a.created_at);
  const repliesOf = (id, n) => state.replies.filter(r => r.bottle_id === id).sort(newest).slice(0, n).reverse().map(replyJson);
  // 상태 숫자는 PostgREST 오류표와 같게: 23514(check) → 400, P0002(없는 병) → 500 (P0001만 400)
  const err = (status, code, message) => ({ status, body: { code, message } });
  const okBottle = (b) => b && b.reports < 3;

  const handlers = {
    list_bottles: ({ p_token }) => state.bottles.filter(okBottle).sort(newest).slice(0, 200).map(b => bottleJson(b, p_token)),
    get_bottle: ({ p_id, p_token }) => {
      const b = state.bottles.find(x => x.id === p_id);
      if (!b || (b.reports >= 3 && b.owner_token !== p_token)) return null;
      return { bottle: bottleJson(b, p_token), liked_by_me: state.likes.has(p_id + '|' + p_token), replies: repliesOf(p_id, 50) };
    },
    create_bottle: ({ p_token, p_nickname, p_shape, p_message, p_x, p_z }) => {
      const nickname = String(p_nickname ?? '').trim(), message = String(p_message ?? '').trim();
      if (!NICK.test(nickname) || !SHAPES.includes(p_shape) || len(message) < 1 || len(message) > 50 ||
          !(p_x >= -18 && p_x <= 18) || !(p_z >= -24 && p_z <= -12)) return err(400, '23514', 'check violation');
      return bottleJson(addBottle({ owner_token: p_token, nickname, shape: p_shape, message, x: p_x, z: p_z }), p_token);
    },
    add_reply: ({ p_token, p_bottle_id, p_nickname, p_message }) => {
      const b = state.bottles.find(x => x.id === p_bottle_id);
      if (!okBottle(b)) return err(500, 'P0002', 'bottle not found');   // 진짜 PostgREST도 P0002를 500으로 준다
      const nickname = String(p_nickname ?? '').trim(), message = String(p_message ?? '').trim();
      if (!NICK.test(nickname) || len(message) < 1 || len(message) > 50) return err(400, '23514', 'check violation');
      return replyJson(addReply(p_bottle_id, { author_token: p_token, nickname, message }));
    },
    like_bottle: ({ p_token, p_bottle_id }) => {
      const b = state.bottles.find(x => x.id === p_bottle_id);
      if (!okBottle(b)) return err(500, 'P0002', 'bottle not found');   // 진짜 PostgREST도 P0002를 500으로 준다
      const k = p_bottle_id + '|' + p_token;
      if (!state.likes.has(k)) { state.likes.add(k); b.likes++; }
      return { likes: b.likes };
    },
    report_bottle: ({ p_token, p_bottle_id }) => {
      const b = state.bottles.find(x => x.id === p_bottle_id);
      if (!b) return err(500, 'P0002', 'bottle not found');   // 진짜 PostgREST도 P0002를 500으로 준다
      const k = p_bottle_id + '|' + p_token;
      if (b.owner_token !== p_token && !state.reports.has(k)) { state.reports.add(k); b.reports++; }
      return { hidden: b.reports >= 3 };
    },
    my_bottles: ({ p_token }) => state.bottles.filter(b => b.owner_token === p_token).sort(newest).map(b => {
      const rs = state.replies.filter(r => r.bottle_id === b.id);
      return { ...bottleJson(b, p_token), hidden: b.reports >= 3, reply_count: rs.length,
        last_reply_at: rs.length ? rs.map(r => r.created_at).sort().at(-1) : null, replies: repliesOf(b.id, 20) };
    })
  };

  await page.route(SUPABASE_URL + '/rest/v1/rpc/**', async route => {
    const req = route.request();
    const fn = new URL(req.url()).pathname.split('/rpc/')[1];
    let body = {};
    try { body = JSON.parse(req.postData() || '{}'); } catch { /* 빈 본문 */ }
    state.calls.push({ fn, body, apikey: req.headers()['apikey'] });
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    if (fail) return route.fulfill({ status: fail, headers: cors, body: JSON.stringify({ message: 'fake failure' }) });
    const h = handlers[fn];
    if (!h) return route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ code: 'PGRST202', message: 'no function' }) });
    const out = h(body);
    if (out && out.status && out.body && typeof out.status === 'number') return route.fulfill({ status: out.status, headers: cors, body: JSON.stringify(out.body) });
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(out) });
  });

  return {
    state,
    setFail: status => { fail = status; },
    addBottle: partial => addBottle(partial),
    addReply: (bottleId, partial) => addReply(bottleId, partial),
    visible: () => state.bottles.filter(okBottle)
  };
}
