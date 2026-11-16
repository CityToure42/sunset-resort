// 이 파일이 하는 일: 모래사장에 조개 12개를 놓고(반짝임), 캐릭터가 가까이 오면 주운 것으로 치워 60초 뒤 다른 빈자리에 다시 놓는다. 조개는 각자 자기 화면에만 있다
import * as THREE from 'three';

export const SHELL_AREA = { xMin: -26, xMax: 26, zMin: -8, zMax: 30 };
export const RESPAWN_MS = 60000;

function shellMesh() {
  const g = new THREE.Group();
  // 부채꼴 가리비: 납작한 반구 + 골 무늬 줄
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffd9e0', roughness: 0.6, flatShading: true }));
  body.scale.set(1, 0.45, 0.85);
  g.add(body);
  for (let i = -2; i <= 2; i++) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.26), new THREE.MeshStandardMaterial({ color: '#f4a7b9' }));
    rib.position.set(i * 0.05, 0.06, 0); rib.rotation.y = i * 0.25;
    g.add(rib);
  }
  return g;
}

let sparkleTex = null;
function sparkle() {
  if (!sparkleTex) {
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d');
    const grd = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd; x.fillRect(0, 0, 32, 32);
    sparkleTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTex, transparent: true, depthWrite: false }));
  s.scale.setScalar(0.45);
  s.position.y = 0.18;
  return s;
}

export function createShellField(scene, { count = 12, rng = Math.random, isFree = () => true, now = () => Date.now() } = {}) {
  const shells = [];   // { x, z, obj, takenAt }
  let sparkles = true;

  function randomSpot() {
    for (let i = 0; i < 200; i++) {
      const x = SHELL_AREA.xMin + rng() * (SHELL_AREA.xMax - SHELL_AREA.xMin);
      const z = SHELL_AREA.zMin + rng() * (SHELL_AREA.zMax - SHELL_AREA.zMin);
      if (isFree(x, z)) return { x, z };
    }
    return { x: 0, z: 10 };   // 못 찾으면(거의 없음) 해변 가운데
  }
  function place(s) {
    const p = randomSpot();
    s.x = p.x; s.z = p.z; s.takenAt = null;
    s.obj.position.set(p.x, 0.02, p.z);
    s.obj.rotation.y = rng() * Math.PI * 2;
    s.obj.visible = true;
  }
  for (let i = 0; i < count; i++) {
    const obj = shellMesh();
    obj.scale.setScalar(1.7);   // 멀리서도 보이게 크게
    const sp = sparkle(); obj.add(sp); obj.userData.sparkle = sp;
    scene.add(obj);
    const s = { obj, x: 0, z: 0, takenAt: null };
    place(s);
    shells.push(s);
  }

  return {
    // pos 근처(r 안)의 조개를 모두 줍고, 주운 개수를 돌려준다
    pickNear(pos, r = 0.8) {
      let n = 0;
      for (const s of shells) {
        if (s.takenAt !== null) continue;
        if (Math.hypot(s.x - pos.x, s.z - pos.z) <= r) { s.takenAt = now(); s.obj.visible = false; n++; }
      }
      return n;
    },
    respawnDue() { const t = now(); for (const s of shells) if (s.takenAt !== null && t - s.takenAt >= RESPAWN_MS) place(s); },
    positions: () => shells.filter(s => s.takenAt === null).map(s => ({ x: s.x, z: s.z })),
    setQuality(q) { sparkles = q !== 'low'; for (const s of shells) s.obj.userData.sparkle.visible = sparkles; },
    update(t) {
      if (!sparkles) return;
      for (let i = 0; i < shells.length; i++) {
        const sp = shells[i].obj.userData.sparkle;
        sp.material.opacity = 0.25 + 0.75 * Math.max(0, Math.sin(t * 2.2 + i * 1.7));   // 하나씩 다른 박자로 반짝
      }
    }
  };
}
