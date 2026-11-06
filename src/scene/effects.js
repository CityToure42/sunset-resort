// 이 파일이 하는 일: 놀기 동작의 시각 효과 — 인사·건배 때 떠오르는 하트, 비치볼 던지기(포물선으로 날아가 1.2초 뒤 사라짐)
import * as THREE from 'three';

const HEART_LIFE = 1.2;
const BALL_LIFE = 1.2;
const GRAVITY = 9.8;

function heartTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#ff6b8a';
  g.beginPath();
  g.moveTo(32, 56);
  g.bezierCurveTo(4, 36, 6, 10, 22, 10);
  g.bezierCurveTo(28, 10, 32, 15, 32, 19);
  g.bezierCurveTo(32, 15, 36, 10, 42, 10);
  g.bezierCurveTo(58, 10, 60, 36, 32, 56);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeBall() {
  // 비치볼: 6조각 색 줄무늬 공
  const g = new THREE.Group();
  const colors = ['#ff6f61', '#fff6ea', '#6cc4ee', '#fff6ea', '#ffd166', '#fff6ea'];
  colors.forEach((c, i) => {
    const geo = new THREE.SphereGeometry(0.22, 12, 8, (i * Math.PI) / 3, Math.PI / 3);
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, flatShading: true }));
    m.castShadow = true;
    g.add(m);
  });
  return g;
}

export function createEffects(scene) {
  const tex = heartTexture();
  const live = [];   // { kind, obj, age, life, vel? }

  function spawnHearts(pos, n = 3) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      s.position.set(pos.x + (i - (n - 1) / 2) * 0.25, pos.y + i * 0.08, pos.z);
      s.scale.setScalar(0.28);
      scene.add(s);
      live.push({ kind: 'heart', obj: s, age: -i * 0.12, life: HEART_LIFE });
    }
  }

  // from: 던지는 손 위치, dir: 수평 방향(라디안, 캐릭터 heading)
  function spawnBall(from, dir) {
    const b = makeBall();
    b.position.set(from.x, from.y, from.z);
    scene.add(b);
    const speed = 4.5;
    live.push({ kind: 'ball', obj: b, age: 0, life: BALL_LIFE, vel: new THREE.Vector3(Math.sin(dir) * speed, 4.2, Math.cos(dir) * speed) });
  }

  function update(dt) {
    for (let i = live.length - 1; i >= 0; i--) {
      const e = live[i];
      e.age += dt;
      if (e.kind === 'heart' && e.age > 0) {
        e.obj.position.y += dt * 0.9;
        e.obj.material.opacity = Math.max(0, 1 - e.age / e.life);
      } else if (e.kind === 'ball') {
        e.vel.y -= GRAVITY * dt;
        e.obj.position.addScaledVector(e.vel, dt);
        if (e.obj.position.y < 0.22) { e.obj.position.y = 0.22; e.vel.y = Math.abs(e.vel.y) * 0.45; e.vel.x *= 0.7; e.vel.z *= 0.7; }
        e.obj.rotation.x += dt * 8;
      }
      if (e.age >= e.life) {
        scene.remove(e.obj);
        e.obj.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.(); });
        live.splice(i, 1);
      }
    }
  }

  return {
    spawnHearts, spawnBall, update,
    get count() { return live.length; },
    get balls() { return live.filter(e => e.kind === 'ball').length; }
  };
}
