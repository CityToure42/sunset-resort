// 이 파일이 하는 일: 휴양객 캐릭터를 기본 도형으로 조립하고(머리·몸통·팔·다리·모자·선글라스·표정·칵테일·튜브), 꾸미기 값(look)에 맞춰 모자·선글라스·셔츠 색·표정을 바꾸고, 손에 든 잔(setDrink)과 허리 튜브(setTube)를 보이거나 숨긴다
import * as THREE from 'three';
import { makeCocktail } from '../scene/props.js';

export const SHIRT_COLORS = ['#ff7f6e', '#ffd166', '#6cc4ee', '#9ad17f', '#f49ac1', '#f4e9d6'];
export const COCKTAIL_COLORS = ['#ff8a3d', '#6cc4ee', '#ff5a8a', '#9ad17f'];
const SKIN = '#f3c9a4';
const FACE_IDS = ['smile', 'round', 'grin', 'wink', 'heart', 'sleepy'];   // profile.js FACES와 같은 순서

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

  // 표정 6가지: 각 표정은 '눈(eyes)'과 '입(mouth)' 그룹. 선글라스를 쓰면 눈만 숨긴다
  parts.faces = buildFaces(head);

  // 허리 튜브(3종 중 하나만 보임)
  parts.tube = buildTube();
  group.add(parts.tube);

  function setLook(l) {
    parts.hatStraw.visible = l.hat === 'straw';
    parts.hatBucket.visible = l.hat === 'bucket';
    parts.glasses.visible = !!l.glasses;
    parts.torso.material.color.set(SHIRT_COLORS[l.shirt] ?? SHIRT_COLORS[0]);
    const face = FACE_IDS.includes(l.face) ? l.face : 'smile';
    for (const id of FACE_IDS) {
      parts.faces[id].visible = id === face;
      parts.faces[id].getObjectByName('eyes').visible = !l.glasses;   // 선글라스를 쓰면 눈은 가려진다
    }
  }
  // 손에 든 잔: null이면 빈손
  function setDrink(index) {
    const on = Number.isInteger(index) && index >= 0 && index < COCKTAIL_COLORS.length;
    parts.cocktail.visible = on;
    if (on) parts.cocktail.getObjectByName('liquid').material.color.set(COCKTAIL_COLORS[index]);
  }
  function setTube(type) {
    parts.tube.visible = !!parts.tube.userData.kinds[type];
    parts.tube.userData.type = parts.tube.visible ? type : null;
    for (const [k, g] of Object.entries(parts.tube.userData.kinds)) g.visible = k === type;
  }
  setLook(look);
  setDrink(null);
  setTube(null);

  return { group, parts, setLook, setDrink, setTube };
}

// ---------- 표정 ----------
// 머리(반지름 0.27) 앞면: 눈은 y 0.04, 입은 y -0.09 근처. 모두 얼굴 표면에서 살짝 앞으로 나오게 둔다
function buildFaces(head) {
  const dark = mat('#2b1d18'), white = mat('#ffffff'), red = mat('#e8475b'), lip = mat('#4a2c24');
  // 표정 6개를 담는 그룹. faces.smile처럼 이름으로도 꺼낼 수 있다
  const faces = new THREE.Group();
  faces.name = 'faces';
  head.add(faces);
  const make = (id, eyes, mouth) => {
    const g = new THREE.Group(); g.name = 'face-' + id;
    const e = new THREE.Group(); e.name = 'eyes'; eyes(e); g.add(e);
    const m = new THREE.Group(); m.name = 'mouth'; mouth(m); g.add(m);
    for (const o of [e, m]) o.traverse(x => { if (x.isMesh) x.castShadow = false; });
    faces.add(g);
    faces[id] = g;
  };
  const dot = (p, x, r = 0.028) => mesh(p, new THREE.SphereGeometry(r, 8, 6), dark, x, 0.04, 0.255);
  const smileMouth = (p, w = 0.06) => { const m = mesh(p, new THREE.TorusGeometry(w, 0.012, 6, 12, Math.PI), lip, 0, -0.09, 0.25); m.rotation.z = Math.PI; };
  const arcEye = (p, x) => { const m = mesh(p, new THREE.TorusGeometry(0.03, 0.009, 5, 10, Math.PI), dark, x, 0.035, 0.258); };   // ∩ 눈웃음
  const lineEye = (p, x, tilt = 0) => { const m = mesh(p, new THREE.BoxGeometry(0.07, 0.014, 0.01), dark, x, 0.035, 0.258); m.rotation.z = tilt; };

  make('smile', e => { dot(e, -0.09); dot(e, 0.09); }, m => smileMouth(m));
  make('round', e => {
    for (const x of [-0.09, 0.09]) { mesh(e, new THREE.SphereGeometry(0.052, 10, 8), white, x, 0.045, 0.235); mesh(e, new THREE.SphereGeometry(0.03, 8, 6), dark, x, 0.045, 0.27); }
  }, m => mesh(m, new THREE.TorusGeometry(0.025, 0.01, 6, 12), lip, 0, -0.095, 0.252));
  make('grin', e => { arcEye(e, -0.09); arcEye(e, 0.09); }, m => {
    const open = mesh(m, new THREE.CircleGeometry(0.07, 12, Math.PI, Math.PI), mat('#7a2a2a', { side: THREE.DoubleSide }), 0, -0.075, 0.256);
    open.rotation.x = -0.25;
  });
  make('wink', e => { dot(e, -0.09); lineEye(e, 0.09); }, m => smileMouth(m, 0.055));
  make('heart', e => {
    for (const x of [-0.09, 0.09]) { const h = mesh(e, heartGeo(), red, x, 0.04, 0.258); h.scale.setScalar(0.11); }
  }, m => smileMouth(m));
  make('sleepy', e => { lineEye(e, -0.09, 0.15); lineEye(e, 0.09, -0.15); }, m => mesh(m, new THREE.BoxGeometry(0.05, 0.012, 0.01), lip, 0, -0.095, 0.252));
  return faces;
}

function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.35);
  s.bezierCurveTo(-0.5, 0.05, -0.3, 0.45, 0, 0.2);
  s.bezierCurveTo(0.3, 0.45, 0.5, 0.05, 0, -0.35);
  return new THREE.ShapeGeometry(s, 8);
}

// ---------- 허리 튜브 ----------
// 허리 높이(0.62)에 끼우는 링. 도넛(분홍+스프링클), 플라밍고(분홍+목·머리), 수박(초록 겉+빨간 안쪽)
function buildTube() {
  const root = new THREE.Group();
  root.position.y = 0.62;
  const kinds = {};
  const ring = (g, color, r = 0.42, t = 0.13) => { const m = mesh(g, new THREE.TorusGeometry(r, t, 8, 20), mat(color, { roughness: 0.5 })); m.rotation.x = Math.PI / 2; return m; };

  const donut = new THREE.Group();
  ring(donut, '#ff9ec7');
  const sprinkle = ['#ffffff', '#6cc4ee', '#ffd166', '#9ad17f'];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const sp = mesh(donut, new THREE.BoxGeometry(0.06, 0.015, 0.02), mat(sprinkle[i % 4]), Math.cos(a) * 0.42, 0.12, Math.sin(a) * 0.42);
    sp.rotation.y = a * 1.7;
  }
  const flamingo = new THREE.Group();
  ring(flamingo, '#ff7eb6');
  const pink = mat('#ff7eb6');
  const neck = mesh(flamingo, new THREE.CylinderGeometry(0.05, 0.06, 0.5, 8), pink, 0, 0.3, 0.42); neck.rotation.x = -0.25;
  mesh(flamingo, new THREE.SphereGeometry(0.1, 10, 8), pink, 0, 0.55, 0.5);
  const beak = mesh(flamingo, new THREE.ConeGeometry(0.035, 0.12, 6), mat('#2b1d18'), 0, 0.53, 0.62); beak.rotation.x = Math.PI / 2;
  const watermelon = new THREE.Group();
  ring(watermelon, '#3fa34d', 0.42, 0.13);
  ring(watermelon, '#ff5a6e', 0.34, 0.07).position.y = 0.06;
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; mesh(watermelon, new THREE.SphereGeometry(0.015, 5, 4), mat('#1d1a1f'), Math.cos(a) * 0.34, 0.12, Math.sin(a) * 0.34); }

  for (const [k, g] of Object.entries({ donut, flamingo, watermelon })) { root.add(g); kinds[k] = g; }
  root.userData.kinds = kinds;
  root.userData.type = null;
  return root;
}
