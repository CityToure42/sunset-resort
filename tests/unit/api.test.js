// 이 파일이 하는 일: 서버와 대화하는 api.js가 요청을 약속대로 만들고, 실패를 offline·timeout·invalid·server로 정확히 나누는지 가짜 fetch로 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi, ApiError } from '../../src/net/api.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../../src/net/config.js';

const URL = 'https://example.supabase.co';
const KEY = 'sb_publishable_test';

function fakeFetch(respond) {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null }); return respond(url, init); };
  fn.calls = calls;
  return fn;
}
const json = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data, text: async () => JSON.stringify(data) });

test('설정값: 프로젝트 주소와 publishable 키', () => {
  assert.equal(SUPABASE_URL, 'https://xrydrdeyaycijtxulgyw.supabase.co');
  assert.equal(SUPABASE_KEY, 'sb_publishable_jJ2gAAnNlaZSO6y5IamVDQ_IfzzY9N6');
});

test('요청 모양: POST rpc/list_bottles, apikey·Content-Type만, 본문 p_token', async () => {
  const f = fakeFetch(() => json(200, []));
  const api = createApi({ url: URL, key: KEY, fetchImpl: f });
  assert.deepEqual(await api.listBottles('t1'), []);
  const c = f.calls[0];
  assert.equal(c.url, `${URL}/rest/v1/rpc/list_bottles`);
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.headers.apikey, KEY);
  assert.equal(c.init.headers['Content-Type'], 'application/json');
  assert.equal('Authorization' in c.init.headers, false);
  assert.deepEqual(c.body, { p_token: 't1' });
});

test('각 함수의 RPC 이름과 인자 이름', async () => {
  const f = fakeFetch(() => json(200, {}));
  const api = createApi({ url: URL, key: KEY, fetchImpl: f });
  await api.getBottle('b1', 't');
  await api.createBottle({ token: 't', nickname: '세민', shape: 'round', message: 'hi', x: 1, z: -15 });
  await api.addReply({ token: 't', bottleId: 'b1', nickname: '세민', message: 'yo' });
  await api.likeBottle('t', 'b1');
  await api.reportBottle('t', 'b1');
  await api.myBottles('t');
  const got = f.calls.map(c => [c.url.split('/rpc/')[1], c.body]);
  assert.deepEqual(got, [
    ['get_bottle', { p_id: 'b1', p_token: 't' }],
    ['create_bottle', { p_token: 't', p_nickname: '세민', p_shape: 'round', p_message: 'hi', p_x: 1, p_z: -15 }],
    ['add_reply', { p_token: 't', p_bottle_id: 'b1', p_nickname: '세민', p_message: 'yo' }],
    ['like_bottle', { p_token: 't', p_bottle_id: 'b1' }],
    ['report_bottle', { p_token: 't', p_bottle_id: 'b1' }],
    ['my_bottles', { p_token: 't' }]
  ]);
});

test('200 + null 본문이면 null', async () => {
  const api = createApi({ url: URL, key: KEY, fetchImpl: fakeFetch(() => json(200, null)) });
  assert.equal(await api.getBottle('x', 't'), null);
});

async function kindOf(promise) {
  try { await promise; return 'no-error'; } catch (e) { assert.ok(e instanceof ApiError, `ApiError 아님: ${e}`); return e; }
}

test('fetch가 거부되면 offline', async () => {
  const api = createApi({ url: URL, key: KEY, fetchImpl: async () => { throw new TypeError('Failed to fetch'); } });
  assert.equal((await kindOf(api.listBottles('t'))).kind, 'offline');
});

test('시간 초과면 timeout', async () => {
  const slow = (url, init) => new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve(json(200, [])), 1000);
    init.signal.addEventListener('abort', () => { clearTimeout(t); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); });
  });
  const api = createApi({ url: URL, key: KEY, fetchImpl: slow, timeoutMs: 50 });
  assert.equal((await kindOf(api.listBottles('t'))).kind, 'timeout');
});

test('400(규칙 위반)은 invalid, 401·500은 server(상태 보존)', async () => {
  const mk = status => createApi({ url: URL, key: KEY, fetchImpl: fakeFetch(() => json(status, { code: '23514', message: 'check violation' })) });
  assert.equal((await kindOf(mk(400).createBottle({ token: 't', nickname: 'a', shape: 'round', message: '', x: 0, z: -18 }))).kind, 'invalid');
  const e401 = await kindOf(mk(401).listBottles('t'));
  assert.equal(e401.kind, 'server'); assert.equal(e401.status, 401);
  assert.equal((await kindOf(mk(500).listBottles('t'))).kind, 'server');
});

test('P0002(없는 병)는 진짜 PostgREST처럼 500으로 와도 notfound로 구분된다', async () => {
  // PostgREST 오류표: P0001 → 400, 그 밖의 P0*** → 500 (docs.postgrest.org/en/stable/references/errors.html)
  const api = createApi({ url: URL, key: KEY, fetchImpl: fakeFetch(() => json(500, { code: 'P0002', message: 'bottle not found' })) });
  assert.equal((await kindOf(api.addReply({ token: 't', bottleId: 'b', nickname: '세민', message: 'x' }))).kind, 'notfound');
  const api404 = createApi({ url: URL, key: KEY, fetchImpl: fakeFetch(() => json(404, {})) });
  assert.equal((await kindOf(api404.likeBottle('t', 'b'))).kind, 'notfound');
});
