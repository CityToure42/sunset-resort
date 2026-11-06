// 이 파일이 하는 일: 한국시간 날짜 계산과 "오늘의 칵테일" 카운터(하루 5잔, 자정 초기화)가 맞는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kstDateKey, CocktailCounter } from '../../src/state/daily.js';

const utc = s => new Date(s);

test('UTC 2026-11-04T14:59Z는 KST 11-04, 15:00Z는 11-05', () => {
  assert.equal(kstDateKey(utc('2026-11-04T14:59:00Z')), '2026-11-04');
  assert.equal(kstDateKey(utc('2026-11-04T15:00:00Z')), '2026-11-05');
});

test('5잔 뒤 take는 ok:false, count 5', () => {
  const c = new CocktailCounter();
  const now = utc('2026-11-04T03:00:00Z');
  for (let i = 0; i < 5; i++) assert.equal(c.take(now).ok, true);
  assert.deepEqual(c.take(now), { ok: false, count: 5 });
  assert.equal(c.remaining(now), 0);
});

test('자정 경계: 23:59 KST에 3잔 → 00:00 KST에 remaining 5', () => {
  const c = new CocktailCounter();
  const late = utc('2026-11-04T14:59:00Z');   // KST 23:59
  for (let i = 0; i < 3; i++) c.take(late);
  assert.equal(c.remaining(late), 2);
  const midnight = utc('2026-11-04T15:00:00Z'); // KST 00:00 다음날
  assert.equal(c.remaining(midnight), 5);
  assert.deepEqual(c.take(midnight), { ok: true, count: 1 });
});

test('toJSON으로 저장하고 복원하면 같은 상태', () => {
  const c = new CocktailCounter();
  const now = utc('2026-11-04T03:00:00Z');
  c.take(now); c.take(now);
  const restored = new CocktailCounter(JSON.parse(JSON.stringify(c)));
  assert.equal(restored.remaining(now), 3);
});
