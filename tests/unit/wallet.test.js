// 이 파일이 하는 일: 조개 지갑 규칙 — 시작 3개, 줍기 +1(상한 9999), 칵테일 사기 −3(모자라면 거절), 한 잔 3모금
import test from 'node:test';
import assert from 'node:assert/strict';
import { START_SHELLS, MAX_SHELLS, PRICE, SIPS, ZEN_SHELL_SECONDS, MENU, earn, buy, sip } from '../../src/state/wallet.js';
import { defaultProfile } from '../../src/state/profile.js';

const P = shells => ({ ...defaultProfile(), shells, drink: null });

test('상수와 메뉴', () => {
  assert.equal(START_SHELLS, 3); assert.equal(MAX_SHELLS, 9999); assert.equal(PRICE, 3); assert.equal(SIPS, 3); assert.equal(ZEN_SHELL_SECONDS, 60);
  assert.deepEqual(MENU.map(m => m.name), ['선셋 오렌지', '블루 라군', '핑크 플라밍고', '모히또']);
  assert.deepEqual(MENU.map(m => m.id), [0, 1, 2, 3]);
});

test('시작 조개 3', () => { assert.equal(defaultProfile().shells, 3); assert.equal(defaultProfile().drink, null); });

test('earn: +1, 9999 상한', () => {
  const p = P(3);
  assert.equal(earn(p), 4); assert.equal(p.shells, 4);
  const q = P(9999); assert.equal(earn(q), 9999);
  assert.equal(earn(P(9990), 50), 9999);
});

test('buy(3): 조개 3 → 0, 모히또를 3모금 든다', () => {
  const p = P(3);
  assert.deepEqual(buy(p, 3), { ok: true });
  assert.equal(p.shells, 0);
  assert.deepEqual(p.drink, { cocktail: 3, sips: 3 });
});

test('조개 부족이면 거절·음수 없음', () => {
  const p = P(2);
  assert.deepEqual(buy(p, 0), { ok: false, reason: 'shells' });
  assert.equal(p.shells, 2); assert.equal(p.drink, null);
  const q = P(6);
  assert.equal(buy(q, 0).ok, true); assert.equal(buy(q, 1).ok, true);
  assert.deepEqual(buy(q, 2), { ok: false, reason: 'shells' });
  assert.equal(q.shells, 0);
});

test("없는 메뉴(9·-1·'1')는 거절", () => {
  for (const id of [9, -1, '1', 1.5, null]) {
    const p = P(9);
    assert.deepEqual(buy(p, id), { ok: false, reason: 'menu' }, String(id));
    assert.equal(p.shells, 9);
  }
});

test('sip 3번이면 빈손', () => {
  const p = P(3); buy(p, 1);
  assert.equal(sip(p), 2); assert.equal(sip(p), 1); assert.equal(sip(p), 0);
  assert.equal(p.drink, null);
  assert.equal(sip(p), null);
});

test('잔을 들고 또 사면 새 잔으로', () => {
  const p = P(6); buy(p, 0); sip(p); sip(p);
  buy(p, 2);
  assert.deepEqual(p.drink, { cocktail: 2, sips: 3 });
});
