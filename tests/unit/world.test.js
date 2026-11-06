// 이 파일이 하는 일: 캐릭터가 갈 수 있는 범위(모래+얕은 물)와 소품에 부딪혔을 때 밀려나는 계산이 맞는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampToBeach, resolveColliders } from '../../src/scene/world.js';

test('clampToBeach: 범위 밖 좌표는 가장자리로 — {x:50,z:-20} → {x:30,z:-12}', () => {
  assert.deepEqual(clampToBeach({ x: 50, z: -20 }), { x: 30, z: -12 });
});

test('clampToBeach: 범위 안은 그대로', () => {
  assert.deepEqual(clampToBeach({ x: -3.5, z: 2 }), { x: -3.5, z: 2 });
});

test('clampToBeach: 뒤쪽(z 40) 경계', () => {
  assert.deepEqual(clampToBeach({ x: 0, z: 99 }), { x: 0, z: 40 });
});

test('resolveColliders: 원과 겹치면 원 밖으로 밀려난다', () => {
  const out = resolveColliders({ x: 0, z: 0 }, 0.4, [{ x: 0.5, z: 0, r: 1 }]);
  const dist = Math.hypot(out.x - 0.5, out.z - 0);
  assert.ok(dist >= 1.4 - 1e-9, `밀려난 거리 ${dist}`);
});

test('resolveColliders: 겹치지 않으면 그대로', () => {
  assert.deepEqual(resolveColliders({ x: 5, z: 5 }, 0.4, [{ x: 0, z: 0, r: 1 }]), { x: 5, z: 5 });
});

test('resolveColliders: 정확히 중심에 있으면 +x 쪽으로 밀어낸다(0으로 나누지 않음)', () => {
  const out = resolveColliders({ x: 2, z: 3 }, 0.4, [{ x: 2, z: 3, r: 1 }]);
  assert.ok(Number.isFinite(out.x) && Number.isFinite(out.z));
  assert.ok(Math.hypot(out.x - 2, out.z - 3) >= 1.4 - 1e-9);
});
