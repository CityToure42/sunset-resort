// 이 파일이 하는 일: 기본 프로필의 모양과 꾸미기 값 정리(normalizeLook)가 약속대로인지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultProfile, normalizeLook, hydrateProfile, DEFAULT_LOOK } from '../../src/state/profile.js';

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
  assert.deepEqual(normalizeLook({ hat: 'cap', shirt: 9 }), { hat: 'straw', glasses: true, shirt: 0, cocktail: 0, face: 'smile' });
});

test('normalizeLook은 정상 값을 그대로 둔다', () => {
  assert.deepEqual(normalizeLook({ hat: 'none', glasses: false, shirt: 5, cocktail: 3, face: 'grin' }), { hat: 'none', glasses: false, shirt: 5, cocktail: 3, face: 'grin' });
});

test('hydrateProfile은 저장된 값의 빈칸·깨진 값을 기본값으로 채운다', async () => {
  const { hydrateProfile } = await import('../../src/state/profile.js');
  const p = hydrateProfile({ nickname: '세민', look: { shirt: 2 }, zenSeconds: 'x', bottles: 'no' });
  assert.equal(p.nickname, '세민');
  assert.deepEqual(p.look, { hat: 'straw', glasses: true, shirt: 2, cocktail: 0, face: 'smile' });
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

test('B단계: reportedIds·lastSeenReplyAt 기본값과 정리', async () => {
  const { defaultProfile, hydrateProfile } = await import('../../src/state/profile.js');
  const d = defaultProfile();
  assert.deepEqual(d.reportedIds, []);
  assert.equal(d.lastSeenReplyAt, '');
  const p = hydrateProfile({ reportedIds: 'x', lastSeenReplyAt: 5 });
  assert.deepEqual(p.reportedIds, []);
  assert.equal(p.lastSeenReplyAt, '');
  const q = hydrateProfile({ reportedIds: ['a', 3, 'b'], lastSeenReplyAt: '2026-11-06T00:00:00Z' });
  assert.deepEqual(q.reportedIds, ['a', 'b']);
  assert.equal(q.lastSeenReplyAt, '2026-11-06T00:00:00Z');
});

import { FACES, TUBES } from '../../src/state/profile.js';

test('표정·튜브 목록', () => {
  assert.deepEqual(FACES, ['smile', 'round', 'grin', 'wink', 'heart', 'sleepy']);
  assert.deepEqual(TUBES, ['donut', 'flamingo', 'watermelon']);
});

test('옛 프로필 정리: 조개 3·빈손·튜브 없음·미소', () => {
  const p = hydrateProfile({ nickname: '세민', token: '11111111-2222-4333-8444-555555555555', look: { hat: 'straw', glasses: true, shirt: 1, cocktail: 2 }, cocktails: { date: '2026-11-05', count: 4 } });
  assert.equal(p.shells, 3); assert.equal(p.drink, null); assert.equal(p.tube, null); assert.equal(p.look.face, 'smile');
  assert.equal(p.look.shirt, 1);
});

test('이상한 값은 기본값으로', () => {
  const p = hydrateProfile({ nickname: '세민', shells: -5, drink: { cocktail: 7, sips: 2 }, tube: 'boat', look: { face: 'evil' } });
  assert.equal(p.shells, 3); assert.equal(p.drink, null); assert.equal(p.tube, null); assert.equal(p.look.face, 'smile');
  assert.equal(hydrateProfile({ shells: 12.5 }).shells, 3);
  assert.equal(hydrateProfile({ shells: 10000 }).shells, 3);
  assert.deepEqual(hydrateProfile({ drink: { cocktail: 1, sips: 0 } }).drink, null);
  assert.deepEqual(hydrateProfile({ drink: { cocktail: 1, sips: 2 } }).drink, { cocktail: 1, sips: 2 });
  assert.equal(hydrateProfile({ tube: 'donut' }).tube, 'donut');
  assert.equal(hydrateProfile({ shells: 0 }).shells, 0);
  assert.equal(hydrateProfile({ look: { face: 'wink' } }).look.face, 'wink');
});
