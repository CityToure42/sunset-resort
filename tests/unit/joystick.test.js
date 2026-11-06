// 이 파일이 하는 일: 조이스틱의 손가락 위치 → 방향 벡터 계산이 맞는지 확인 (순수 함수)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joystickVector } from '../../src/ui/joystick.js';

test('원점이면 0벡터', () => {
  assert.deepEqual(joystickVector({ x: 100, y: 100 }, { x: 100, y: 100 }), { x: 0, y: 0 });
});

test('오른쪽 60px → x 1, y 0', () => {
  const v = joystickVector({ x: 100, y: 100 }, { x: 160, y: 100 }, 60);
  assert.ok(Math.abs(v.x - 1) < 1e-9 && Math.abs(v.y) < 1e-9);
});

test('위로 30px → y -0.5 (화면 좌표는 아래가 +)', () => {
  const v = joystickVector({ x: 100, y: 100 }, { x: 100, y: 70 }, 60);
  assert.ok(Math.abs(v.x) < 1e-9 && Math.abs(v.y + 0.5) < 1e-9);
});

test('120px 끌어도 길이 1 이하', () => {
  const v = joystickVector({ x: 0, y: 0 }, { x: 120, y: 0 }, 60);
  assert.ok(Math.hypot(v.x, v.y) <= 1 + 1e-9);
});
