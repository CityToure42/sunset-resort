// 이 파일이 하는 일: 플레이어 이동(속도 2.5, 카메라 기준 방향, dt 상한, 경계)이 약속대로인지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../../src/character/player.js';
import { buildAvatar } from '../../src/character/avatar.js';
import { AnimationController } from '../../src/character/animations.js';
import { DEFAULT_LOOK } from '../../src/state/profile.js';

function make(clamp = p => p) {
  const avatar = buildAvatar({ ...DEFAULT_LOOK });
  const anim = new AnimationController(avatar.parts, avatar.group);
  const world = { clamp };
  const player = createPlayer({ avatar, anim, world });
  return { avatar, anim, player };
}

test('입력 {x:0,y:-1}(앞으로) 1초 → z가 -2.5 (camYaw 0)', () => {
  const { player } = make();
  for (let i = 0; i < 20; i++) player.step(0.05, { x: 0, y: -1 }, 0);
  assert.ok(Math.abs(player.position.z + 2.5) < 1e-6, `z=${player.position.z}`);
  assert.ok(Math.abs(player.position.x) < 1e-6);
});

test('dt 5초를 넣어도 0.05초만 이동', () => {
  const { player } = make();
  player.step(5, { x: 0, y: -1 }, 0);
  assert.ok(Math.abs(player.position.z + 0.125) < 1e-6, `z=${player.position.z}`);
});

test('입력 0이면 anim.setMoving(false), 입력 있으면 walk', () => {
  const { player, anim } = make();
  player.step(0.05, { x: 1, y: 0 }, 0);
  assert.equal(anim.state, 'walk');
  player.step(0.05, { x: 0, y: 0 }, 0);
  assert.equal(anim.state, 'idle');
});

test('camYaw가 π/2면 "앞으로" 입력이 -x 방향으로 간다', () => {
  const { player } = make();
  player.step(0.05, { x: 0, y: -1 }, Math.PI / 2);
  assert.ok(player.position.x < -0.1, `x=${player.position.x}`);
  assert.ok(Math.abs(player.position.z) < 1e-6);
});

test('이동 방향으로 heading이 바뀐다', () => {
  const { player } = make();
  player.step(0.05, { x: 1, y: 0 }, 0);   // 오른쪽(+x)
  assert.ok(Math.abs(player.heading - Math.PI / 2) < 1e-6, `heading=${player.heading}`);
});

test('world.clamp를 거친다', () => {
  const { player } = make(() => ({ x: 1, z: 2 }));
  player.step(0.05, { x: 0, y: -1 }, 0);
  assert.deepEqual([player.position.x, player.position.z], [1, 2]);
});
