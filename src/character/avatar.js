// 이 파일이 하는 일: 휴양객 캐릭터를 기본 도형으로 조립하고(머리·몸통·팔·다리·모자·선글라스·칵테일), 꾸미기 값(look)에 맞춰 모자·선글라스·셔츠 색·칵테일 색을 바꾼다
import * as THREE from 'three';
import { makeCocktail } from '../scene/props.js';

export const SHIRT_COLORS = ['#ff7f6e', '#ffd166', '#6cc4ee', '#9ad17f', '#f49ac1', '#f4e9d6'];
export const COCKTAIL_COLORS = ['#ff8a3d', '#6cc4ee', '#ff5a8a', '#9ad17f'];
const SKIN = '#f3c9a4';

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0, flatShading: true }, extra || {}));
const mesh = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

// 관절에서 아래로 늘어진 팔·다리: 그룹의 원점이 관절이라 rotation.x로 앞뒤로 흔들 수 있다
function limb(parent, x, y, z, radius, length, material) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  mesh(g, new THREE.CylinderGeometry(radius, radius, length, 8), material, 0, -length / 2, 0);
  parent.add(g);
  return g;
}

export function buildAvatar(look) {
  const group = new THREE.Group();
  // 'YXZ' 순서: 먼저 몸을 돌리고(heading) 그다음 '자기 기준'으로 뒤로 젖힌다 → 어느 방향을 보든 눕기가 '등을 대고 눕기'가 된다
  group.rotation.order = 'YXZ';
  const skin = mat(SKIN);
  const parts = {};

  // 다리 (관절 높이 0.46)
  parts.legL = limb(group, -0.12, 0.46, 0, 0.085, 0.46, skin);
  parts.legR = limb(group, 0.12, 0.46, 0, 0.085, 0.46, skin);
  mesh(parts.legL, new THREE.BoxGeometry(0.22, 0.05, 0.3), mat('#6b4a2e'), 0, -0.44, 0.03);
  mesh(parts.legR, new THREE.BoxGeometry(0.22, 0.05, 0.3), mat('#6b4a2e'), 0, -0.44, 0.03);

  // 반바지 + 셔츠(몸통)
  mesh(group, new THREE.BoxGeometry(0.46, 0.3, 0.28), mat('#3b6ea5'), 0, 0.58, 0);
  const body = new THREE.Group();
  body.position.y = 0.98;
  group.add(body);
  parts.body = body;
  parts.torso = mesh(body, new THREE.BoxGeometry(0.5, 0.52, 0.3), mat(SHIRT_COLORS[0]), 0, 0, 0);
  for (const [x, y] of [[-0.15, 0.12], [0.12, 0.04], [-0.02, -0.12], [0.18, 0.2], [-0.18, -0.14]]) {
    mesh(body, new THREE.SphereGeometry(0.035, 6, 5), mat('#fff6ea'), x, y, 0.16);
  }

  // 팔 (어깨 높이 1.2) — 오른팔 끝에 칵테일
  parts.armL = limb(body, -0.33, 0.2, 0, 0.06, 0.5, skin);
  parts.armL.rotation.z = 0.18;
  parts.armR = limb(body, 0.33, 0.2, 0, 0.06, 0.5, skin);
  mesh(parts.armR, new THREE.SphereGeometry(0.075, 8, 6), skin, 0, -0.5, 0);
  parts.cocktail = makeCocktail(COCKTAIL_COLORS[0]);
  parts.cocktail.position.set(0.02, -0.56, 0.06);
  parts.cocktail.scale.setScalar(1.25);
  parts.armR.add(parts.cocktail);
  parts.armR.rotation.x = -1.35;
  parts.armR.rotation.z = -0.25;

  // 머리 (그룹: 머리·머리카락·모자·선글라스·입)
  const head = new THREE.Group();
  head.position.y = 0.52;   // body 기준 → 월드 1.5
  body.add(head);
  parts.head = head;
  mesh(head, new THREE.SphereGeometry(0.27, 12, 9), skin, 0, 0, 0);
  const hair = mesh(head, new THREE.SphereGeometry(0.28, 12, 9), mat('#4a2c24'), 0, 0.08, -0.03);
  hair.scale.set(1, 0.55, 1);

  parts.hatStraw = new THREE.Group();
  mesh(parts.hatStraw, new THREE.CylinderGeometry(0.5, 0.5, 0.035, 12), mat('#ead29a'), 0, 0.16, 0);
  mesh(parts.hatStraw, new THREE.CylinderGeometry(0.27, 0.3, 0.18, 12), mat('#ead29a'), 0, 0.26, 0);
  mesh(parts.hatStraw, new THREE.CylinderGeometry(0.305, 0.305, 0.05, 12), mat('#e8743f'), 0, 0.2, 0);
  head.add(parts.hatStraw);

  parts.hatBucket = new THREE.Group();
  mesh(parts.hatBucket, new THREE.CylinderGeometry(0.24, 0.36, 0.22, 12), mat('#fff6ea'), 0, 0.22, 0);
  mesh(parts.hatBucket, new THREE.CylinderGeometry(0.245, 0.245, 0.06, 12), mat('#6cc4ee'), 0, 0.14, 0);
  head.add(parts.hatBucket);

  parts.glasses = new THREE.Group();
  parts.glasses.position.set(0, 0.03, 0.24);
  const black = mat('#1d1a1f', { roughness: 0.3 });
  mesh(parts.glasses, new THREE.BoxGeometry(0.15, 0.093, 0.05), black, -0.093, 0, 0);
  mesh(parts.glasses, new THREE.BoxGeometry(0.15, 0.093, 0.05), black, 0.093, 0, 0);
  mesh(parts.glasses, new THREE.BoxGeometry(0.045, 0.02, 0.03), black, 0, 0.01, 0);
  head.add(parts.glasses);

  const smile = mesh(head, new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), mat('#4a2c24'), 0, -0.09, 0.25);
  smile.rotation.z = Math.PI;
  smile.castShadow = false;

  function setLook(l) {
    parts.hatStraw.visible = l.hat === 'straw';
    parts.hatBucket.visible = l.hat === 'bucket';
    parts.glasses.visible = !!l.glasses;
    parts.torso.material.color.set(SHIRT_COLORS[l.shirt] ?? SHIRT_COLORS[0]);
    parts.cocktail.getObjectByName('liquid').material.color.set(COCKTAIL_COLORS[l.cocktail] ?? COCKTAIL_COLORS[0]);
  }
  setLook(look);

  return { group, parts, setLook };
}
