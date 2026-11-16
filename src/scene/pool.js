// 이 파일이 하는 일: 버블풀 — 해변 뒤쪽 수영장(물·흰 테두리·사다리)과, 수면에서 계속 피어오르는 비눗방울·떠 있는 거품. 느린 폰에선 비눗방울을 절반만 띄운다
import * as THREE from 'three';

const SURFACE_Y = 0.05;   // 모래 윗면(0) 바로 위. 잠긴 몸은 모래가 가려 줘서 물속처럼 보인다
const BUBBLES = 40, FOAM = 30;

export function createPool(scene, { x, z, w, d }, rng = Math.random) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const mat = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.5, flatShading: true }, extra || {}));

  // 물: 밝은 청록 반투명 판
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat('#5fd6e0', { transparent: true, opacity: 0.78, roughness: 0.15, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = SURFACE_Y;
  water.receiveShadow = true;
  g.add(water);
  // 흰 테두리(폭 0.4, 높이 0.15) 네 변
  const rim = mat('#f7f3ea');
  for (const [px, pz, sx, sz] of [[0, -d / 2 - 0.2, w + 0.8, 0.4], [0, d / 2 + 0.2, w + 0.8, 0.4], [-w / 2 - 0.2, 0, 0.4, d], [w / 2 + 0.2, 0, 0.4, d]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.15, sz), rim);
    r.position.set(px, 0.075, pz); r.castShadow = true; r.receiveShadow = true;
    g.add(r);
  }
  // 사다리(바다 쪽 변 가운데)
  const steel = mat('#c9d3dc', { metalness: 0.6, roughness: 0.3 });
  for (const sx of [-0.25, 0.25]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.025, 6, 10, Math.PI), steel);
    rail.position.set(sx, 0.15, -d / 2 + 0.05); rail.rotation.y = Math.PI / 2;
    g.add(rail);
  }

  // 비눗방울: 무지갯빛이 도는 반투명 구. 수면에서 생겨 1.5~3m까지 떠오르며 흔들리다 사라지고 다시
  const bubbleMat = new THREE.MeshStandardMaterial({ color: '#e8f6ff', emissive: '#9fd8ff', emissiveIntensity: 0.25, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.3, depthWrite: false });
  const bubbles = [];
  for (let i = 0; i < BUBBLES; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rng() * 0.08, 10, 8), bubbleMat);
    b.userData = { bx: (rng() - 0.5) * (w - 0.6), bz: (rng() - 0.5) * (d - 0.6), top: 1.5 + rng() * 1.5, speed: 0.12 + rng() * 0.12, phase: rng() };
    g.add(b);
    bubbles.push(b);
  }
  // 거품: 수면에 떠 있는 흰 납작한 원판 무리
  const foamMat = mat('#ffffff', { transparent: true, opacity: 0.85 });
  const foam = [];
  for (let i = 0; i < FOAM; i++) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.12 + rng() * 0.18, 0.12 + rng() * 0.18, 0.04, 10), foamMat);
    f.position.set((rng() - 0.5) * (w - 0.4), SURFACE_Y + 0.02, (rng() - 0.5) * (d - 0.4));
    f.userData.phase = rng() * Math.PI * 2;
    g.add(f);
    foam.push(f);
  }
  scene.add(g);

  let active = BUBBLES;
  return {
    group: g,
    get bubbleCount() { return active; },
    setQuality(q) {
      active = q === 'low' ? BUBBLES / 2 : BUBBLES;
      bubbles.forEach((b, i) => { b.visible = i < active; });
    },
    update(t) {
      for (let i = 0; i < active; i++) {
        const b = bubbles[i], u = b.userData;
        const k = (t * u.speed + u.phase) % 1;   // 0→1 한 번 떠오르기
        b.position.set(u.bx + Math.sin(t * 1.3 + i) * 0.15 * k, SURFACE_Y + k * u.top, u.bz + Math.cos(t * 1.1 + i) * 0.15 * k);
        b.scale.setScalar(k > 0.92 ? Math.max(0.01, (1 - k) / 0.08) : 1);   // 꼭대기에서 톡 터지듯 작아진다
      }
      for (const f of foam) f.position.y = SURFACE_Y + 0.02 + Math.sin(t * 1.5 + f.userData.phase) * 0.015;
    }
  };
}
