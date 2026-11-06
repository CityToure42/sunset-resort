// 이 파일이 하는 일: 두께가 있는 모래 해변(물결 모양 해안선), 젖은 모래 띠, 멀리 보이는 섬을 만든다
import * as THREE from 'three';

export const SAND_COLOR = '#f3dfb8';

export function createBeach(scene) {
  // Shape는 XY 평면에 그린다. rotateX(-90°)를 하면 shape의 y가 -z로 가므로 y=9가 해안선 z=-9, y=-60이 카메라 뒤쪽 z=60이 된다
  const shape = new THREE.Shape();
  shape.moveTo(-90, -60);
  shape.lineTo(-90, 9);
  for (let x = -90; x < 90; x += 6) {
    shape.quadraticCurveTo(x + 3, 9 + ((x / 6) % 2 === 0 ? 2.2 : -2.2), x + 6, 9);
  }
  shape.lineTo(90, -60);
  shape.lineTo(-90, -60);
  // 두께 0.6으로 뽑아내서(extrude) 바다 아래로 턱이 생기게 → 파도가 모래 위로 비치지 않는다
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -0.6, 0);
  const sand = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SAND_COLOR, roughness: 1, flatShading: true }));
  sand.receiveShadow = true;
  scene.add(sand);

  // 젖은 모래 띠: 굽이치는 해안선(z 약 -7.9 ~ -10.1)보다 넓게 깔아서, 모래가 들어간 곳에도 바다가 비치는 틈이 없게 한다
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(200, 4.4), new THREE.MeshStandardMaterial({ color: '#e7cfa6', roughness: 1 }));
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(0, -0.04, -9.6);
  wet.receiveShadow = true;
  scene.add(wet);

  const islandMat = new THREE.MeshStandardMaterial({ color: '#5d5b8a', flatShading: true });
  for (const [x, z, r, h] of [[-95, -180, 22, 6], [120, -200, 30, 9]]) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), islandMat);
    m.position.set(x, -1, z);
    scene.add(m);
  }

  return { mesh: sand };
}
