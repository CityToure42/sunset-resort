// 이 파일이 하는 일: 휴양객 캐릭터가 약속한 부품으로 조립되고, 꾸미기(setLook)가 모자·선글라스·셔츠·칵테일에 반영되는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAvatar, SHIRT_COLORS, COCKTAIL_COLORS } from '../../src/character/avatar.js';
import { DEFAULT_LOOK, FACES, TUBES } from '../../src/state/profile.js';

const PART_NAMES = ['head', 'torso', 'armL', 'armR', 'legL', 'legR', 'hatStraw', 'hatBucket', 'glasses', 'cocktail', 'faces', 'tube'];

test('부품 12개가 모두 Object3D', () => {
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

test('setDrink(2) 후 잔이 보이고 액체 색이 COCKTAIL_COLORS[2], setDrink(null)이면 숨김', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  a.setDrink(2);
  assert.equal(a.parts.cocktail.visible, true);
  const liquid = a.parts.cocktail.getObjectByName('liquid');
  assert.equal(liquid.material.color.getHexString(), COCKTAIL_COLORS[2].slice(1).toLowerCase());
  a.setDrink(null);
  assert.equal(a.parts.cocktail.visible, false);
});

test('기본은 빈손·미소', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  assert.equal(a.parts.cocktail.visible, false);
  for (const f of FACES) assert.equal(a.parts.faces[f].visible, f === 'smile', f);
  assert.equal(a.parts.tube.visible, false);
});

test('표정: 선글라스 벗으면 눈까지, 쓰면 눈은 숨고 입만', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  for (const f of FACES) assert.ok(a.parts.faces[f].getObjectByName('eyes'), `${f} 눈 그룹`);
  a.setLook({ ...DEFAULT_LOOK, face: 'round', glasses: false });
  assert.equal(a.parts.faces.round.visible, true);
  assert.equal(a.parts.faces.smile.visible, false);
  assert.equal(a.parts.faces.round.getObjectByName('eyes').visible, true);
  a.setLook({ ...DEFAULT_LOOK, face: 'round', glasses: true });
  assert.equal(a.parts.faces.round.getObjectByName('eyes').visible, false);
  assert.equal(a.parts.faces.round.getObjectByName('mouth').visible, true);
});

test('setTube: 종류별로 보이고 null이면 숨김', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  for (const t of TUBES) {
    a.setTube(t);
    assert.equal(a.parts.tube.visible, true);
    assert.equal(a.parts.tube.userData.type, t);
  }
  a.setTube(null);
  assert.equal(a.parts.tube.visible, false);
});

test('전체 높이는 1.6~1.9', () => {
  const a = buildAvatar({ ...DEFAULT_LOOK });
  a.group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(a.group);
  const h = box.max.y - box.min.y;
  assert.ok(h >= 1.6 && h <= 1.9, `높이 ${h}`);
});
