// 이 파일이 하는 일: 시각(KST)에 따라 하늘 분위기(파스텔/골든아워/드라마틱)가 약속대로 골라지는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moodAt, PALETTES, EVENT_HOUR } from '../../src/state/mood.js';

// KST 시:분 → UTC Date (같은 날 2026-11-04 기준)
const kst = (h, m) => new Date(Date.UTC(2026, 10, 4, h - 9, m));

test('18:29 pastel, 18:30 golden, 19:00 dramatic, 19:29 dramatic, 19:30 pastel (KST)', () => {
  assert.equal(moodAt(kst(18, 29)), 'pastel');
  assert.equal(moodAt(kst(18, 30)), 'golden');
  assert.equal(moodAt(kst(19, 0)), 'dramatic');
  assert.equal(moodAt(kst(19, 29)), 'dramatic');
  assert.equal(moodAt(kst(19, 30)), 'pastel');
  assert.equal(moodAt(kst(3, 0)), 'pastel');
});

test('석양 이벤트는 19시', () => {
  assert.equal(EVENT_HOUR, 19);
});

test('팔레트 3종이 같은 키를 가진다', () => {
  const keys = ['top', 'mid', 'horizon', 'sun', 'glow', 'water', 'fog', 'light', 'lightIntensity', 'hemiSky', 'hemiGround'];
  for (const name of ['pastel', 'golden', 'dramatic']) {
    for (const k of keys) assert.ok(k in PALETTES[name], `${name}.${k} 없음`);
    assert.match(PALETTES[name].top, /^#[0-9a-f]{6}$/i);
  }
});
