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

// 내 병 위에 띄우는 작은 별(캔버스로 그린 그림)
let starTexture = null;
function makeStar() {
  if (!starTexture) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#ffd166';
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 28 : 12, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      g[i === 0 ? 'moveTo' : 'lineTo'](32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    starTexture = new THREE.CanvasTexture(c);
    starTexture.colorSpace = THREE.SRGBColorSpace;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture, transparent: true, depthWrite: false }));
  s.scale.setScalar(0.35);
  s.name = 'mine-star';
  return s;
}

export function createBottleField(scene) {
  const meshes = new Map();   // id → { obj, phase, star }

  function place(obj, b) {
    obj.position.set(b.x, -0.05, b.z);
    obj.rotation.set(0, 0, Math.PI / 2 - 0.35);   // 옆으로 비스듬히 누워 떠 있게
    obj.scale.setScalar(1.6);
  }

  function set(bottles) {
    const list = bottles.slice(0, MAX_BOTTLES);
    const keep = new Set(list.map(b => b.id));
    for (const [id, m] of meshes) {
      if (!keep.has(id)) { scene.remove(m.obj); if (m.star) scene.remove(m.star); meshes.delete(id); }
    }
    for (const b of list) {
      if (meshes.has(b.id)) continue;
      const obj = createBottleMesh(b.shape);
      place(obj, b);
      obj.userData.id = b.id;
      scene.add(obj);
      let star = null;
      if (b.isMine) { star = makeStar(); star.position.set(b.x, 0.9, b.z); scene.add(star); }
      meshes.set(b.id, { obj, phase: hash(b.id), star });
    }
  }

  function update(t) {
    for (const { obj, phase, star } of meshes.values()) {
      obj.position.y = -0.05 + Math.sin(t + phase) * 0.06;
      if (star) star.position.y = 0.9 + Math.sin(t * 1.5 + phase) * 0.08;
      obj.rotation.y = Math.sin(t * 0.3 + phase) * 0.4;
    }
  }

  // 병의 화면 좌표(CSS 픽셀). 카메라 뒤에 있거나 없는 병이면 null
  const v = new THREE.Vector3();
  function screenPos(id, camera) {
    const m = meshes.get(id);
    if (!m) return null;
    v.copy(m.obj.position).project(camera);
    if (v.z > 1 || v.z < -1) return null;
    return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - v.y) / 2 * window.innerHeight };
  }

  // 누른 곳(ndc: -1~1)에 있는 병 id. 병이 작아서 손가락이 살짝 빗나가도 되게,
  // 직접 맞은 병이 없으면 화면에서 tolerancePx 안에 있는 가장 가까운 병을 고른다
  const raycaster = new THREE.Raycaster();
  function pickBottle(ndc, camera, tolerancePx = 28) {
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects([...meshes.values()].map(m => m.obj), true);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.id) o = o.parent;
      if (o) return o.userData.id;
    }
    const tx = (ndc.x + 1) / 2 * window.innerWidth, ty = (1 - ndc.y) / 2 * window.innerHeight;
    let best = null, bestD = tolerancePx;
    for (const id of meshes.keys()) {
      const p = screenPos(id, camera);
      if (!p) continue;
      const d = Math.hypot(p.x - tx, p.y - ty);
      if (d <= bestD) { best = id; bestD = d; }
    }
    return best;
  }

  return {
    set, update, place, screenPos, pickBottle,
    get count() { return meshes.size; }, get starCount() { return [...meshes.values()].filter(m => m.star).length; }
  };
}
