// 이 파일이 하는 일: 동작 상태 기계(가만히/걷기/인사/건배/춤/눕기/비치볼/마시기)가 약속대로 전환되고 팔다리를 움직이는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AnimationController, EMOTES } from '../../src/character/animations.js';
import { buildAvatar } from '../../src/character/avatar.js';
import { DEFAULT_LOOK } from '../../src/state/profile.js';

const make = () => { const a = buildAvatar({ ...DEFAULT_LOOK }); return { a, c: new AnimationController(a.parts, a.group) }; };

test('처음엔 idle', () => {
  assert.equal(make().c.state, 'idle');
});

test('EMOTES 지속시간: wave 1.6, cheers 1.4, dance 2.4, lie 무한, throw 1.2, drink 1.5', () => {
  assert.deepEqual(EMOTES, { wave: 1.6, cheers: 1.4, dance: 2.4, lie: Infinity, throw: 1.2, drink: 1.5 });
});

test('setMoving(true) → walk, setMoving(false) → idle', () => {
  const { c } = make();
  c.setMoving(true); assert.equal(c.state, 'walk');
  c.setMoving(false); assert.equal(c.state, 'idle');
});

test("play('wave') 후 1.7초 지나면 idle", () => {
  const { c } = make();
  c.play('wave'); assert.equal(c.state, 'wave');
  c.update(1.0); assert.equal(c.state, 'wave');
  c.update(0.7); assert.equal(c.state, 'idle');
});

test("play('lie')는 stop()까지 유지", () => {
  const { c } = make();
  c.play('lie'); c.update(100); assert.equal(c.state, 'lie');
  c.stop(); assert.equal(c.state, 'idle');
});

test('동작 중 이동하면 동작이 끊기고 walk', () => {
  const { c } = make();
  c.play('dance'); c.setMoving(true); assert.equal(c.state, 'walk');
});

test('walk 중 update(0.3) 뒤 다리가 흔들린다', () => {
  const { a, c } = make();
  c.setMoving(true); c.update(0.3);
  assert.notEqual(a.parts.legL.rotation.x, 0);
});

test('idle로 돌아오면 다리가 제자리(0)로 돌아온다', () => {
  const { a, c } = make();
  c.setMoving(true); c.update(0.3); c.setMoving(false); c.update(1.0);
  assert.ok(Math.abs(a.parts.legL.rotation.x) < 0.05);
});

test('lie 상태에서는 몸(group)이 눕는다', () => {
  const { a, c } = make();
  c.play('lie'); c.update(0.5);
  assert.ok(a.group.rotation.x < -0.8, `rotation.x ${a.group.rotation.x}`);
});

test('모르는 동작은 무시', () => {
  const { c } = make();
  c.play('fly'); assert.equal(c.state, 'idle');
});
