// 이 파일이 하는 일: 기본 프로필의 모양과 꾸미기 값 정리(normalizeLook)가 약속대로인지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, normalizeLook, DEFAULT_LOOK } from '../../src/state/profile.js';

test('defaultProfile의 token은 UUID 형식', () => {
  const p = defaultProfile();
  assert.match(p.token, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('defaultProfile의 필드 구성', () => {
  const p = defaultProfile();
  assert.equal(p.nickname, '');
  assert.deepEqual(p.look, DEFAULT_LOOK);
  assert.equal(p.zenSeconds, 0);
  assert.deepEqual(p.cocktails, { date: '', count: 0 });
  assert.deepEqual(p.bottles, []);
});

test('normalizeLook은 범위 밖 값을 기본값으로', () => {
  assert.deepEqual(normalizeLook({ hat: 'cap', shirt: 9 }), { hat: 'straw', glasses: true, shirt: 0, cocktail: 0 });
});

test('normalizeLook은 정상 값을 그대로 둔다', () => {
  assert.deepEqual(normalizeLook({ hat: 'none', glasses: false, shirt: 5, cocktail: 3 }), { hat: 'none', glasses: false, shirt: 5, cocktail: 3 });
});

test('hydrateProfile은 저장된 값의 빈칸·깨진 값을 기본값으로 채운다', async () => {
  const { hydrateProfile } = await import('../../src/state/profile.js');
  const p = hydrateProfile({ nickname: '세민', look: { shirt: 2 }, zenSeconds: 'x', bottles: 'no' });
  assert.equal(p.nickname, '세민');
  assert.deepEqual(p.look, { hat: 'straw', glasses: true, shirt: 2, cocktail: 0 });
  assert.equal(p.zenSeconds, 0);
  assert.deepEqual(p.bottles, []);
  assert.match(p.token, /^[0-9a-f-]{36}$/);
});

test('I5: 저장값이 파싱은 되지만 이상해도(look:null, bottles에 null·불완전 항목) 안전한 프로필', async () => {
  const { hydrateProfile, normalizeLook, DEFAULT_LOOK } = await import('../../src/state/profile.js');
  assert.deepEqual(normalizeLook(null), { ...DEFAULT_LOOK });
  assert.deepEqual(normalizeLook('x'), { ...DEFAULT_LOOK });
  const good = { id: 'a1', shape: 'round', message: '안녕', x: 0, z: -18, createdAt: '2026-11-05T00:00:00Z', likes: 0, nickname: '세민' };
  const p = hydrateProfile({ nickname: '세민', look: null, bottles: [null, 7, { id: 'b' }, { ...good, x: 99 }, good], cocktails: null });
  assert.deepEqual(p.look, { ...DEFAULT_LOOK });
  assert.deepEqual(p.bottles, [good]);
  assert.deepEqual(p.cocktails, { date: '', count: 0 });
});

test('I5: 저장값 자체가 배열·숫자여도 기본 프로필', async () => {
  const { hydrateProfile } = await import('../../src/state/profile.js');
  for (const bad of [[], 5, 'str', null]) {
    const p = hydrateProfile(bad);
    assert.equal(p.nickname, '');
    assert.deepEqual(p.bottles, []);
  }
});
