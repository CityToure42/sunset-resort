// 이 파일이 하는 일: 다른 사람 캐릭터를 다루는 순수 계산 — 부드럽게 따라가기, 30초 소식 없음 고르기, 가까운 30명 고르기
import test from 'node:test';
import assert from 'node:assert/strict';
import { stepToward, staleSids, nearestSids } from '../../src/features/people.js';

test('stepToward: dt 0.5에 남은 거리 10% 이하, 0이면 그대로', () => {
  const p = stepToward({ x: 0, z: 0 }, { x: 10, z: 0 }, 0.5);
  assert.ok(10 - p.x <= 1, `남은 거리 ${10 - p.x}`);
  assert.ok(p.x < 10);
  assert.deepEqual(stepToward({ x: 1, z: 2 }, { x: 5, z: 5 }, 0), { x: 1, z: 2 });
});

test('staleSids: 마지막 소식 29999ms 전은 남고 30000ms 전은 나온다', () => {
  const people = new Map([['a', { lastSeen: 1 }], ['b', { lastSeen: 2 }]]);
  assert.deepEqual(staleSids(people, 30001), ['a']);
  assert.deepEqual(staleSids(people, 30000), []);
});

test('nearestSids: 35명 중 나와 가까운 30명', () => {
  const people = new Map();
  for (let i = 0; i < 35; i++) people.set('p' + i, { pos: { x: i, z: 0 } });
  const s = nearestSids(people, { x: 0, z: 0 });
  assert.equal(s.size, 30);
  assert.ok(s.has('p0') && s.has('p29'));
  assert.ok(!s.has('p30') && !s.has('p34'));
  assert.equal(nearestSids(people, { x: 34, z: 0 }).has('p0'), false);
});

import { disposeAvatar } from '../../src/features/people.js';
import { buildAvatar } from '../../src/character/avatar.js';
import { DEFAULT_LOOK } from '../../src/state/profile.js';

test('disposeAvatar: 아바타의 모든 도형·재질이 GPU 메모리를 돌려준다', () => {
  const a = buildAvatar(DEFAULT_LOOK);
  const things = new Set();
  a.group.traverse(o => { if (o.isMesh) { things.add(o.geometry); [].concat(o.material).forEach(m => things.add(m)); } });
  assert.ok(things.size > 10);
  const disposed = new Set();
  for (const t of things) t.addEventListener('dispose', () => disposed.add(t));
  disposeAvatar(a.group);
  assert.equal(disposed.size, things.size);
});
