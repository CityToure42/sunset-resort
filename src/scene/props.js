// 이 파일이 하는 일: 야자수·수상 방갈로·선베드 세트·해변 바 같은 소품을 기본 도형으로 조립해 놓고, 부딪히는 원(충돌 영역)과 중요한 자리(선베드·바·병 구역)를 알려준다
import * as THREE from 'three';

const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.9, metalness: 0, flatShading: true }, extra || {}));
const add = (parent, geo, material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
};

export function makeCocktail(liquid = '#ff8a3d') {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.07, 0.07, 0.015, 10), mat('#dfe9f3'), 0, 0.008, 0);
  add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.11, 6), mat('#dfe9f3'), 0, 0.07, 0);
  const glassGeo = new THREE.ConeGeometry(0.12, 0.17, 10, 1, true); glassGeo.rotateX(Math.PI);
  const glass = add(g, glassGeo, new THREE.MeshStandardMaterial({ color: '#dff1ff', transparent: true, opacity: 0.35, roughness: 0.2, side: THREE.DoubleSide }), 0, 0.21, 0);
  glass.castShadow = false;
  const liqGeo = new THREE.ConeGeometry(0.1, 0.13, 10); liqGeo.rotateX(Math.PI);
  const liq = add(g, liqGeo, mat(liquid, { roughness: 0.4 }), 0, 0.19, 0);
  liq.name = 'liquid';
  const stick = add(g, new THREE.CylinderGeometry(0.006, 0.006, 0.2, 4), mat('#f7e2b0'), 0.05, 0.32, 0); stick.rotation.z = -0.5;
  const um = add(g, new THREE.ConeGeometry(0.075, 0.045, 8), mat('#ff5a8a'), 0.095, 0.4, 0); um.rotation.z = -0.5;
  const straw = add(g, new THREE.CylinderGeometry(0.007, 0.007, 0.22, 4), mat('#ff5a7a'), -0.05, 0.33, 0); straw.rotation.z = 0.35;
  add(g, new THREE.SphereGeometry(0.022, 6, 5), mat('#d7263d'), 0.02, 0.3, 0.03);
  return g;
}

function palm(scene, x, z, lean, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.3, 1.6, 0), new THREE.Vector3(lean * 0.8, 3.2, 0.1), new THREE.Vector3(lean * 1.2, 4.4, 0.15)]);
  add(g, new THREE.TubeGeometry(curve, 10, 0.16, 7, false), mat('#9b6b43'));
  const crown = new THREE.Group();
  crown.position.copy(curve.getPoint(1));
  g.add(crown);
  for (let i = 0; i < 8; i++) {
    const leafG = new THREE.Group();
    leafG.rotation.y = i * Math.PI / 4 + (i % 2) * 0.2;
    const geo = new THREE.ConeGeometry(0.34, 2.8, 4);
    geo.translate(0, 1.4, 0);
    geo.scale(1, 1, 0.3);
    const leaf = add(leafG, geo, mat(i % 2 ? '#3f9a5a' : '#4caf6b'));
    leaf.rotation.z = -Math.PI / 2 - 0.38 - (i % 3) * 0.12;
    crown.add(leafG);
  }
  for (let i = 0; i < 3; i++) add(crown, new THREE.SphereGeometry(0.17, 8, 6), mat('#7a4b2a'), Math.cos(i * 2.1) * 0.22, -0.2, Math.sin(i * 2.1) * 0.22);
  scene.add(g);
  return { x, z, r: 0.5 * s };
}

function bungalow(scene, x, z, rot) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  for (const [sx, sz] of [[-2, -1.8], [2, -1.8], [-2, 1.8], [2, 1.8]]) add(g, new THREE.CylinderGeometry(0.14, 0.14, 1.7, 6), mat('#6b4a2e'), sx, 0.6, sz);
  add(g, new THREE.BoxGeometry(5.4, 0.22, 4.8), mat('#c9a27a'), 0, 1.4, 0);
  add(g, new THREE.BoxGeometry(4.2, 2.3, 3.6), mat('#f4e9d6'), 0, 2.65, 0);
  const roof = add(g, new THREE.ConeGeometry(3.7, 1.9, 4), mat('#a9774a'), 0, 4.75, 0);
  roof.rotation.y = Math.PI / 4;
  const win = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 0.9 });
  add(g, new THREE.BoxGeometry(0.9, 0.9, 0.08), win, 0.6, 2.7, 1.84);
  add(g, new THREE.BoxGeometry(0.9, 0.9, 0.08), win, -0.9, 2.7, 1.84);
  add(g, new THREE.BoxGeometry(1.3, 0.16, 9), mat('#c9a27a'), 0, 1.3, 6.3);
  scene.add(g);
}

function sunbedSet(scene, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry;
  add(g, new THREE.BoxGeometry(0.8, 0.12, 1.9), mat('#fff6ea'), 0, 0.32, 0);
  add(g, new THREE.BoxGeometry(0.8, 0.1, 1.9), mat('#ffb4a2'), 0, 0.42, 0);
  const back = add(g, new THREE.BoxGeometry(0.8, 0.7, 0.1), mat('#ffb4a2'), 0, 0.72, -0.85);
  back.rotation.x = -0.35;
  for (const [sx, sz] of [[-0.32, -0.8], [0.32, -0.8], [-0.32, 0.8], [0.32, 0.8]]) add(g, new THREE.BoxGeometry(0.08, 0.3, 0.08), mat('#fff6ea'), sx, 0.15, sz);
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), mat('#f1e4d0'), 1.7, 1.3, -0.3);
  add(g, new THREE.ConeGeometry(1.35, 0.55, 8), mat('#ff6f61'), 1.7, 2.55, -0.3);
  add(g, new THREE.CylinderGeometry(0.26, 0.26, 0.05, 8), mat('#fff6ea'), 0.95, 0.52, 0.7);
  add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), mat('#fff6ea'), 0.95, 0.26, 0.7);
  const ck = makeCocktail('#ff8a3d');
  ck.position.set(0.95, 0.55, 0.7);
  ck.scale.setScalar(1.1);
  g.add(ck);
  scene.add(g);
  // 파라솔 기둥(로컬 1.7, -0.3)을 월드 좌표로 돌려서 충돌 원을 만든다
  const ux = 1.7 * Math.cos(ry) + -0.3 * Math.sin(ry), uz = -1.7 * Math.sin(ry) + -0.3 * Math.cos(ry);
  return [{ x, z, r: 1.0 }, { x: x + ux, z: z + uz, r: 0.25 }];
}

function beachBar(scene, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  add(g, new THREE.BoxGeometry(2.4, 1.0, 0.8), mat('#c9a27a'), 0, 0.5, 0);
  add(g, new THREE.BoxGeometry(2.6, 0.08, 1.0), mat('#f4e9d6'), 0, 1.04, 0);
  for (const sx of [-1.1, 1.1]) add(g, new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), mat('#9b6b43'), sx, 1.9, -0.3);
  const roof = add(g, new THREE.ConeGeometry(2.1, 0.9, 4), mat('#a9774a'), 0, 3.3, -0.3);
  roof.rotation.y = Math.PI / 4;
  for (let i = 0; i < 3; i++) {
    const ck = makeCocktail(['#ff8a3d', '#6cc4ee', '#ff5a8a'][i]);
    ck.position.set(-0.7 + i * 0.7, 1.08, 0.1);
    ck.scale.setScalar(1.1);
    g.add(ck);
  }
  scene.add(g);
  return { x, z, r: 1.5 };
}

export function createProps(scene) {
  const colliders = [];
  colliders.push(palm(scene, -6.2, -5, 0.9, 1.1), palm(scene, 7.4, -4.2, -0.8, 1.0), palm(scene, -10, 1.5, 0.5, 1.25), palm(scene, 11, 2, -0.4, 0.95), palm(scene, -7.5, 5.5, 0.3, 0.9));
  bungalow(scene, -15, -24, 0.25);
  bungalow(scene, 17, -28, -0.2);
  // 등받이가 바다 반대편(+z)으로 가도록 돌려 놓는다 → 누우면 발끝 너머로 석양이 보인다
  const sunbed = { x: 5.3, z: 2.0, ry: Math.PI - 0.45 };
  colliders.push(...sunbedSet(scene, sunbed.x, sunbed.z, sunbed.ry));
  const bar = { x: -5.5, z: 4 };
  colliders.push(beachBar(scene, bar.x, bar.z));
  const points = { sunbed, bar, bottleArea: { xMin: -18, xMax: 18, zMin: -24, zMax: -12 } };
  return { colliders, points };
}
