// 이 파일이 하는 일: 서버 저장소(RemoteBottleStore)가 서버 응답을 앱 모양(camelCase)으로 바꾸고, 잘못된 병은 서버에 보내지 않으며, A단계 병 옮기기가 실패분만 남기는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteBottleStore } from '../../src/state/remoteBottles.js';
import { ApiError } from '../../src/net/api.js';

const serverBottle = { id: 'b1', nickname: '세민', shape: 'round', message: '안녕', x: 1, z: -15, created_at: '2026-11-06T01:00:00Z', likes: 2, is_mine: true };

function fakeApi(over = {}) {
  const calls = [];
  const rec = (name, ret) => async (...args) => { calls.push([name, ...args]); return typeof ret === 'function' ? ret(...args) : ret; };
  return Object.assign({
    calls,
    listBottles: rec('listBottles', [serverBottle]),
    getBottle: rec('getBottle', { bottle: serverBottle, liked_by_me: true, replies: [{ id: 'r1', nickname: '친구', message: '예쁘다', created_at: '2026-11-06T02:00:00Z' }] }),
    createBottle: rec('createBottle', serverBottle),
    addReply: rec('addReply', { id: 'r2', nickname: '세민', message: '고마워', created_at: '2026-11-06T03:00:00Z' }),
    likeBottle: rec('likeBottle', { likes: 3 }),
    reportBottle: rec('reportBottle', { hidden: false }),
    myBottles: rec('myBottles', [{ ...serverBottle, hidden: true, reply_count: 1, last_reply_at: '2026-11-06T02:00:00Z', replies: [{ id: 'r1', nickname: '친구', message: '예쁘다', created_at: '2026-11-06T02:00:00Z' }] }])
  }, over);
}

const camel = { id: 'b1', nickname: '세민', shape: 'round', message: '안녕', x: 1, z: -15, createdAt: '2026-11-06T01:00:00Z', likes: 2, isMine: true };

test('list: snake_case → camelCase, 토큰 전달', async () => {
  const api = fakeApi();
  const s = new RemoteBottleStore({ api, token: 'T' });
  assert.deepEqual(await s.list(), [camel]);
  assert.deepEqual(api.calls[0], ['listBottles', 'T']);
});

test('get: 카드 데이터 모양, null은 null', async () => {
  const s = new RemoteBottleStore({ api: fakeApi(), token: 'T' });
  assert.deepEqual(await s.get('b1'), { bottle: camel, likedByMe: true, replies: [{ id: 'r1', nickname: '친구', message: '예쁘다', createdAt: '2026-11-06T02:00:00Z' }] });
  const s2 = new RemoteBottleStore({ api: fakeApi({ getBottle: async () => null }), token: 'T' });
  assert.equal(await s2.get('x'), null);
});

test('add: 잘못된 입력은 서버를 부르지 않고 invalid', async () => {
  const api = fakeApi();
  const s = new RemoteBottleStore({ api, token: 'T' });
  await assert.rejects(s.add({ shape: 'round', message: '', x: 0, z: -18, nickname: '세민' }), e => e instanceof ApiError && e.kind === 'invalid');
  assert.equal(api.calls.length, 0);
  const b = await s.add({ shape: 'round', message: ' 안녕 ', x: 1, z: -15, nickname: '세민' });
  assert.deepEqual(b, camel);
  assert.deepEqual(api.calls[0], ['createBottle', { token: 'T', nickname: '세민', shape: 'round', message: '안녕', x: 1, z: -15 }]);
});

test('like·report·reply·mine', async () => {
  const s = new RemoteBottleStore({ api: fakeApi(), token: 'T' });
  assert.equal(await s.like('b1'), 3);
  assert.equal(await s.report('b1'), false);
  assert.deepEqual(await s.reply('b1', '세민', '고마워'), { id: 'r2', nickname: '세민', message: '고마워', createdAt: '2026-11-06T03:00:00Z' });
  const [m] = await s.mine();
  assert.equal(m.hidden, true);
  assert.equal(m.replyCount, 1);
  assert.equal(m.lastReplyAt, '2026-11-06T02:00:00Z');
  assert.equal(m.replies[0].createdAt, '2026-11-06T02:00:00Z');
  assert.equal(m.createdAt, '2026-11-06T01:00:00Z');
});

test('migrateLocal: 3개 중 2번째 실패 → moved 2, failed 1, 실패분만 남고, 다시 하면 그것만 시도', async () => {
  let n = 0;
  const api = fakeApi({ createBottle: async args => { n++; if (args.message === '둘') throw new ApiError('offline', 'x'); return { ...serverBottle, message: args.message }; } });
  const s = new RemoteBottleStore({ api, token: 'T' });
  const local = ['하나', '둘', '셋'].map((m, i) => ({ id: 'l' + i, shape: 'jar', message: m, x: 0, z: -18, nickname: '세민', createdAt: '2026-11-05T00:00:00Z', likes: 0 }));
  let saved = 0;
  assert.deepEqual(await s.migrateLocal(local, () => { saved++; }), { moved: 2, failed: 1 });
  assert.deepEqual(local.map(b => b.message), ['둘']);
  assert.ok(saved >= 1);
  n = 0;
  api.createBottle = async args => { n++; return { ...serverBottle, message: args.message }; };
  assert.deepEqual(await s.migrateLocal(local, () => {}), { moved: 1, failed: 0 });
  assert.equal(n, 1);
  assert.equal(local.length, 0);
});

test('migrateLocal: 규칙에 안 맞는 옛 병(검증 실패)은 버린다(영원히 재시도하지 않음)', async () => {
  const s = new RemoteBottleStore({ api: fakeApi(), token: 'T' });
  const local = [{ id: 'bad', shape: 'cup', message: 'x', x: 0, z: -18, nickname: '세민' }];
  assert.deepEqual(await s.migrateLocal(local, () => {}), { moved: 0, failed: 0 });
  assert.equal(local.length, 0);
});
