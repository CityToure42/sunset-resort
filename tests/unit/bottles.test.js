// 이 파일이 하는 일: 유리병 편지 검증 규칙(모양·글자수·위치)과 폰 저장소(BottleStore)가 약속대로인지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHAPES, validateBottle, BottleStore, BOTTLE_AREA, clampToBottleArea } from '../../src/state/bottles.js';

const ok = { shape: 'round', message: '안녕 바다', x: 0, z: -18 };

test('병 모양은 6종', () => {
  assert.deepEqual(SHAPES, ['round', 'tall', 'square', 'jar', 'heart', 'star']);
});

test('병 구역은 x -18~18, z -24~-12', () => {
  assert.deepEqual(BOTTLE_AREA, { xMin: -18, xMax: 18, zMin: -24, zMax: -12 });
});

test('정상 입력은 통과하고 메시지 앞뒤 공백을 지운다', () => {
  assert.deepEqual(validateBottle({ ...ok, message: '  안녕 바다  ' }), { ok: true, value: ok });
});

test("모르는 모양 'cup' → shape", () => {
  assert.deepEqual(validateBottle({ ...ok, shape: 'cup' }), { ok: false, reason: 'shape' });
});

test('빈 메시지·공백만 → message', () => {
  assert.deepEqual(validateBottle({ ...ok, message: '' }), { ok: false, reason: 'message' });
  assert.deepEqual(validateBottle({ ...ok, message: '   ' }), { ok: false, reason: 'message' });
});

test('51자 → message, 50자는 통과', () => {
  assert.deepEqual(validateBottle({ ...ok, message: '가'.repeat(51) }), { ok: false, reason: 'message' });
  assert.equal(validateBottle({ ...ok, message: '가'.repeat(50) }).ok, true);
});

test('모래 위 {x:0,z:0} → position', () => {
  assert.deepEqual(validateBottle({ ...ok, x: 0, z: 0 }), { ok: false, reason: 'position' });
});

test('숫자가 아닌 좌표 → position', () => {
  assert.deepEqual(validateBottle({ ...ok, x: 'a' }), { ok: false, reason: 'position' });
});

test('clampToBottleArea는 구역 밖 좌표를 가장자리로', () => {
  assert.deepEqual(clampToBottleArea({ x: 40, z: 5 }), { x: 18, z: -12 });
  assert.deepEqual(clampToBottleArea({ x: -2, z: -15 }), { x: -2, z: -15 });
});

test('BottleStore.add: 목록에 들어가고, id는 UUID, 좋아요 0, save 호출', () => {
  const arr = [];
  let saved = 0;
  const store = new BottleStore(arr, () => { saved++; });
  const b = store.add({ ...ok, nickname: '세민' });
  assert.equal(store.list().length, 1);
  assert.equal(arr.length, 1, '프로필 배열을 직접 채운다');
  assert.match(b.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  assert.equal(b.likes, 0);
  assert.equal(b.nickname, '세민');
  assert.ok(!Number.isNaN(Date.parse(b.createdAt)));
  assert.equal(saved, 1);
});

test('BottleStore.list는 최신순', () => {
  const store = new BottleStore([], () => {});
  const a = store.add({ ...ok, message: '첫째' });
  a.createdAt = '2026-11-01T00:00:00.000Z';
  store.add({ ...ok, message: '둘째' });
  assert.deepEqual(store.list().map(b => b.message), ['둘째', '첫째']);
});

test('BottleStore.add는 잘못된 입력이면 예외', () => {
  const store = new BottleStore([], () => {});
  assert.throws(() => store.add({ ...ok, message: '' }), /message/);
});
