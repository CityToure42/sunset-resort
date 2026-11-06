// 이 파일이 하는 일: 유리병 6종을 기본 도형으로 만들고(유리·코르크·안에 말린 편지), 앞바다에 둥실둥실 띄워 보여준다
import * as THREE from 'three';

export const MAX_BOTTLES = 200;
const GLASS_TINT = { round: '#bfe9e2', tall: '#c7f0d0', square: '#cfe3ff', jar: '#e8f6ff', heart: '#ffd1dc', star: '#fff1b8' };

const glassMat = color => new THREE.MeshPhysicalMaterial({ color, roughness: 0.1, metalness: 0, transmission: 0, transparent: true, opacity: 0.55, flatShading: true });
const solid = color => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });

function part(group, geo, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  group.add(m);
  return m;
}

function starGeometry() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.34 : 0.15;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const fn = i === 0 ? 'moveTo' : 'lineTo';
    s[fn](Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: false });
  g.translate(0, 0, -0.08);
  return g;
}

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.bezierCurveTo(-0.38, -0.02, -0.3, 0.3, 0, 0.16);
  s.bezierCurveTo(0.3, 0.3, 0.38, -0.02, 0, -0.3);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -0.09);
  return g;
}

// 병 하나: 몸통(모양별) + 목 + 코르크 + 안에 말린 편지. 세로로 세운 상태로 만들고, 띄울 때 눕힌다
export function createBottleMesh(shape) {
  const g = new THREE.Group();
  const glass = glassMat(GLASS_TINT[shape] ?? GLASS_TINT.round);
  let neckY = 0.32;
  switch (shape) {
    case 'tall': part(g, new THREE.CylinderGeometry(0.15, 0.15, 0.62, 10), glass, 0, 0, 0); neckY = 0.4; break;
    case 'square': part(g, new THREE.BoxGeometry(0.36, 0.46, 0.36), glass, 0, 0, 0); neckY = 0.32; break;
    case 'jar': part(g, new THREE.CylinderGeometry(0.28, 0.25, 0.4, 12), glass, 0, 0, 0); neckY = 0.24; break;
    case 'heart': part(g, heartGeometry(), glass, 0, 0, 0); neckY = 0.26; break;
    case 'star': part(g, starGeometry(), glass, 0, 0, 0); neckY = 0.4; break;
    default: part(g, new THREE.SphereGeometry(0.27, 12, 9), glass, 0, 0, 0); neckY = 0.32;
  }
  const wideNeck = shape === 'jar';
  part(g, new THREE.CylinderGeometry(wideNeck ? 0.18 : 0.07, wideNeck ? 0.2 : 0.08, 0.16, 10), glass, 0, neckY, 0);
  part(g, new THREE.CylinderGeometry(wideNeck ? 0.17 : 0.065, wideNeck ? 0.17 : 0.06, 0.1, 10), solid('#a9774a'), 0, neckY + 0.11, 0);
  // 안에 든 편지: 노란빛 종이 두루마리 + 빨간 끈
  part(g, new THREE.CylinderGeometry(0.045, 0.045, 0.24, 8), solid('#fff3d6'), 0, 0, 0);
  part(g, new THREE.TorusGeometry(0.048, 0.01, 4, 10), solid('#d7263d'), 0, 0, 0).rotation.x = Math.PI / 2;
  g.userData.shape = shape;
  return g;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return (h >>> 0) / 4294967295 * Math.PI * 2;
}

export function createBottleField(scene) {
  const meshes = new Map();   // id → { obj, phase }

  function place(obj, b) {
    obj.position.set(b.x, -0.05, b.z);
    obj.rotation.set(0, 0, Math.PI / 2 - 0.35);   // 옆으로 비스듬히 누워 떠 있게
    obj.scale.setScalar(1.6);
  }

  function set(bottles) {
    const list = bottles.slice(0, MAX_BOTTLES);
    const keep = new Set(list.map(b => b.id));
    for (const [id, m] of meshes) {
      if (!keep.has(id)) { scene.remove(m.obj); meshes.delete(id); }
    }
    for (const b of list) {
      if (meshes.has(b.id)) continue;
      const obj = createBottleMesh(b.shape);
      place(obj, b);
      obj.userData.id = b.id;
      scene.add(obj);
      meshes.set(b.id, { obj, phase: hash(b.id) });
    }
  }

  function update(t) {
    for (const { obj, phase } of meshes.values()) {
      obj.position.y = -0.05 + Math.sin(t + phase) * 0.06;
      obj.rotation.y = Math.sin(t * 0.3 + phase) * 0.4;
    }
  }

  return { set, update, get count() { return meshes.size; }, place };
}
