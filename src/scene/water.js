// 이 파일이 하는 일: 출렁이는 바다 평면을 만든다. 해안선에 가까울수록 파도가 잔잔해져서 모래 위로 물이 비치지 않는다
import * as THREE from 'three';

export const WATER_Y = -0.12;
export const SHORE_Z = -9;      // 이 z보다 큰 쪽(카메라 쪽)이 모래
export const DEEP_Z = -22;      // 이 z보다 먼 쪽은 파도 100%

export function createWater(scene, { segments = 70 } = {}) {
  const material = new THREE.MeshPhongMaterial({ color: '#4a7fb5', specular: '#ffe9c9', shininess: 95, transparent: true, opacity: 0.94, flatShading: true });
  let geometry, basePos;
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.position.y = WATER_Y;
  mesh.receiveShadow = true;
  scene.add(mesh);

  function build(n) {
    geometry?.dispose();
    geometry = new THREE.PlaneGeometry(420, 420, n, n);
    geometry.rotateX(-Math.PI / 2);
    basePos = geometry.attributes.position.array.slice();
    mesh.geometry = geometry;
    api.segments = n;
  }

  function update(t) {
    const p = geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 3) {
      const x = basePos[i], z = basePos[i + 2];
      const deep = Math.min(1, Math.max(0, (SHORE_Z - z) / (SHORE_Z - DEEP_Z)));
      const amp = 0.12 + 0.88 * deep;
      p[i + 1] = (Math.sin(x * 0.25 + t * 1.1) * 0.09 + Math.sin(z * 0.18 - t * 0.8) * 0.07 + Math.sin((x + z) * 0.12 + t * 0.5) * 0.05) * amp;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
  }

  const api = { mesh, material, segments, update, setSegments: build, setColor: c => material.color.set(c) };
  build(segments);
  return api;
}
