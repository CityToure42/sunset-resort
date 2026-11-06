// 이 파일이 하는 일: 휴양객 캐릭터가 약속한 부품으로 조립되고, 꾸미기(setLook)가 모자·선글라스·셔츠·칵테일에 반영되는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAvatar, SHIRT_COLORS, COCKTAIL_COLORS } from '../../src/character/avatar.js';
import { DEFAULT_LOOK } from '../../src/state/profile.js';

const PART_NAMES = ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'hatStraw', 'hatBucket', 'glasses', 'cocktail'];

test('부품 10개가 모두 Object3D', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  for (const n of PART_NAMES) assert.ok(a.parts[n] instanceof THREE.Object3D, `${n} 없음`);
});

test('색 목록 길이: 셔츠 6, 칵테일 4', () => {
  assert.equal(SHIRT_COLORS.length, 6);
  assert.equal(COCKTAIL_COLORS.length, 4);
});

test('기본 look은 밀짚모자만 보인다', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  assert.equal(a.parts.hatStraw.visible, true);
  assert.equal(a.parts.hatBucket.visible, false);
  assert.equal(a.parts.glasses.visible, true);
});

test("setLook({hat:'none'}) 후 두 모자 모두 안 보인다", () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  a.setLook({ ...DEFAULT_LOOK, hat: 'none', glasses: false });
  assert.equal(a.parts.hatStraw.visible, false);
  assert.equal(a.parts.hatBucket.visible, false);
  assert.equal(a.parts.glasses.visible, false);
});

test('setLook({shirt:3}) 후 몸통 색이 SHIRT_COLORS[3]', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  a.setLook({ ...DEFAULT_LOOK, shirt: 3 });
  assert.equal(a.parts.torso.material.color.getHexString(), SHIRT_COLORS[3].slice(1).toLowerCase());
});

test('setLook({cocktail:2}) 후 칵테일 액체 색이 COCKTAIL_COLORS[2]', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  a.setLook({ ...DEFAULT_LOOK, cocktail: 2 });
  const liquid = a.parts.cocktail.getObjectByName('liquid');
  assert.equal(liquid.material.color.getHexString(), COCKTAIL_COLORS[2].slice(1).toLowerCase());
});

test('전체 높이는 1.6~1.9', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  a.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.group);
  const h = box.max.y - box.min.y;
  assert.ok(h >= 1.6 && h <= 1.9, `높이 ${h}`);
});
