// 이 파일이 하는 일: 장소 규칙 — 어디가 모래·얕은 물·바다·수영장인지, 튜브가 있으면 앞바다까지 갈 수 있는지, 빈 선베드 고르기, 선베드 배치가 겹치지 않는지
import test from 'node:test';
import assert from 'node:assert/strict';
import { SHORE_Z, SHALLOW_MIN_Z, TUBE_MIN_Z, SEA_X, POOL, TUBE_RACK, SUNBEDS, placeOf, clampFor, isFreeSpot, chooseSunbed } from '../../src/scene/places.js';

test('상수', () => {
  assert.equal(SHORE_Z, -9.5); assert.equal(SHALLOW_MIN_Z, -12); assert.equal(TUBE_MIN_Z, -22); assert.equal(SEA_X, 28);
  assert.deepEqual(POOL, { x: 9, z: 14, w: 8, d: 5 });
  assert.deepEqual(TUBE_RACK, { x: -12, z: -7 });
  assert.deepEqual(SUNBEDS.map(s => [s.x, s.z]), [[5.3, 2.0], [1.8, 2.0], [-1.7, 2.6], [8.7, 1.0], [3.5, 6.5], [7.5, 6.5]]);
  for (const s of SUNBEDS) assert.equal(s.ry, Math.PI - 0.45);
});

test('placeOf 경계', () => {
  assert.equal(placeOf(9, 14), 'pool');
  assert.equal(placeOf(4.9, 14), 'sand');
  assert.equal(placeOf(13.1, 14), 'sand');
  assert.equal(placeOf(9, 11.4), 'sand');
  assert.equal(placeOf(0, -9.5), 'sand');
  assert.equal(placeOf(0, -9.6), 'shallow');
  assert.equal(placeOf(0, -12), 'shallow');
  assert.equal(placeOf(0, -12.1), 'sea');
});

test('clampFor: 튜브 없으면 −12, 있으면 −22까지', () => {
  assert.deepEqual(clampFor({ x: 0, z: -20 }), { x: 0, z: -12 });
  assert.deepEqual(clampFor({ x: 0, z: -20 }, { tube: true }), { x: 0, z: -20 });
  assert.deepEqual(clampFor({ x: 0, z: -30 }, { tube: true }), { x: 0, z: -22 });
  assert.deepEqual(clampFor({ x: 35, z: -15 }, { tube: true }), { x: 28, z: -15 });
  assert.deepEqual(clampFor({ x: 35, z: 5 }), { x: 30, z: 5 });
  assert.deepEqual(clampFor({ x: 0, z: 50 }), { x: 0, z: 40 });
});

test('chooseSunbed: 가장 가까운 빈 자리, 다 차면 가장 가까운 자리', () => {
  assert.deepEqual(chooseSunbed(SUNBEDS, { x: 5, z: 2 }, [{ x: 5.3, z: 2.0 }]), SUNBEDS[1]);   // (1.8, 2.0), 거리 3.2
  assert.deepEqual(chooseSunbed(SUNBEDS, { x: 1.8, z: 4 }, []), SUNBEDS[1]);
  assert.deepEqual(chooseSunbed(SUNBEDS, { x: 1.8, z: 4 }, [{ x: 1.8, z: 2.9 }]), SUNBEDS[4]);   // (3.5, 6.5)
  assert.deepEqual(chooseSunbed(SUNBEDS, { x: 5, z: 2 }, SUNBEDS.map(s => ({ x: s.x, z: s.z }))), SUNBEDS[0]);
});

test('SUNBEDS 배치가 서로·야자수·바·수영장과 겹치지 않는다', () => {
  const palms = [[-6.2, -5], [7.4, -4.2], [-10, 1.5], [11, 2], [-7.5, 5.5]];
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let i = 0; i < SUNBEDS.length; i++) {
    const a = [SUNBEDS[i].x, SUNBEDS[i].z];
    for (let j = i + 1; j < SUNBEDS.length; j++) assert.ok(d(a, [SUNBEDS[j].x, SUNBEDS[j].z]) >= 3.0, `sunbed ${i}-${j}`);
    for (const p of palms) assert.ok(d(a, p) >= 2.0, `palm ${p}`);
    assert.ok(d(a, [-5.5, 4]) >= 3.5, 'bar');
    assert.notEqual(placeOf(a[0], a[1]), 'pool');
  }
});

test('isFreeSpot: 수영장 안·소품 원 안은 안 된다', () => {
  const cs = [{ x: 0, z: 0, r: 1 }];
  assert.equal(isFreeSpot(9, 14, cs), false);
  assert.equal(isFreeSpot(0.5, 0, cs), false);
  assert.equal(isFreeSpot(1.5, 0, cs), false);   // r 1 + 여유 0.6 안
  assert.equal(isFreeSpot(1.7, 0, cs), true);
});
