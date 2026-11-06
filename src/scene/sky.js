// 이 파일이 하는 일: 하늘 돔(3색 그라데이션), 태양과 빛무리, 조명(주광·보조광·환경광), 안개를 만들고 팔레트에 맞춰 색을 바꾼다
import * as THREE from 'three';
import { PALETTES } from '../state/mood.js';

const SKY_RADIUS = 300;

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createSky(scene) {
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, horizon: { value: new THREE.Color() } },
    vertexShader: 'varying float vH; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vH = w.y / ' + SKY_RADIUS.toFixed(1) + '; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 horizon; varying float vH; void main(){ float h = clamp(vH, 0.0, 1.0); vec3 c = mix(horizon, mid, smoothstep(0.0, 0.22, h)); c = mix(c, top, smoothstep(0.18, 0.75, h)); gl_FragColor = vec4(c, 1.0); }'
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 24, 12), skyMat);
  scene.add(dome);

  const sunMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(12, 32), sunMat);
  sun.position.set(0, 9, -250);
  scene.add(sun);

  const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), color: '#ffffff', transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMat);
  glow.position.copy(sun.position);
  glow.scale.set(70, 70, 1);
  scene.add(glow);

  const hemi = new THREE.HemisphereLight('#c6a0ff', '#e4c89a', 0.6);
  scene.add(hemi);

  const sunLight = new THREE.DirectionalLight('#ffcfa8', 1.5);
  sunLight.position.set(0, 14, -40);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunLight.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 120 });
  sunLight.shadow.bias = -0.0015;
  scene.add(sunLight);

  const fill = new THREE.DirectionalLight('#ffd9c0', 0.55);
  fill.position.set(6, 9, 14);
  scene.add(fill);

  scene.fog = new THREE.Fog('#ffb996', 55, 230);

  // 현재 색(from)과 목표 색(to) 사이를 blend(0~1)만큼 섞어 적용 — 무드가 서서히 바뀌게
  const current = JSON.parse(JSON.stringify(PALETTES.pastel));
  const tmp = new THREE.Color();
  const lerpHex = (a, b, k) => '#' + tmp.set(a).lerp(new THREE.Color(b), k).getHexString();

  function applyMood(palette, blend = 1) {
    const p = typeof palette === 'string' ? PALETTES[palette] : palette;
    for (const k of Object.keys(current)) {
      if (k === 'lightIntensity') current[k] = current[k] + (p[k] - current[k]) * blend;
      else current[k] = lerpHex(current[k], p[k], blend);
    }
    skyMat.uniforms.top.value.set(current.top);
    skyMat.uniforms.mid.value.set(current.mid);
    skyMat.uniforms.horizon.value.set(current.horizon);
    sunMat.color.set(current.sun);
    glowMat.color.set(current.glow);
    scene.fog.color.set(current.fog);
    sunLight.color.set(current.light);
    sunLight.intensity = current.lightIntensity;
    hemi.color.set(current.hemiSky);
    hemi.groundColor.set(current.hemiGround);
    return current;
  }
  applyMood('pastel', 1);

  function setShadows(on) { sunLight.castShadow = !!on; }

  return { applyMood, setShadows, sunLight, current };
}
