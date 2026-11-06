// 이 파일이 하는 일: 해변 전체를 조립하고(하늘·바다·모래·소품), 캐릭터가 갈 수 있는 범위와 소품 충돌을 한 함수(clamp)로 묶어 준다
import { createSky } from './sky.js';
import { createWater } from './water.js';
import { createBeach } from './beach.js';
import { createProps } from './props.js';

// 갈 수 있는 범위: 모래(z ≥ -9)와 발목 깊이 얕은 물(-12 ≤ z < -9), x는 -30~30, 뒤쪽은 z 40까지
export const BOUNDS = { xMin: -30, xMax: 30, zMin: -12, zMax: 40 };

export function clampToBeach({ x, z }) {
  return {
    x: Math.min(BOUNDS.xMax, Math.max(BOUNDS.xMin, x)),
    z: Math.min(BOUNDS.zMax, Math.max(BOUNDS.zMin, z))
  };
}

// 원형 충돌: 캐릭터(반지름 r)가 소품 원과 겹치면 원 중심 반대 방향으로 밀어낸다
export function resolveColliders(p, r, circles) {
  let { x, z } = p;
  for (const c of circles) {
    const dx = x - c.x, dz = z - c.z;
    const dist = Math.hypot(dx, dz);
    const minDist = c.r + r;
    if (dist < minDist) {
      if (dist < 1e-9) { x = c.x + minDist; z = c.z; }   // 정확히 중심이면 +x로
      else { x = c.x + dx / dist * minDist; z = c.z + dz / dist * minDist; }
    }
  }
  return { x, z };
}

export function createWorld(scene) {
  const sky = createSky(scene);
  const water = createWater(scene);
  const beach = createBeach(scene);
  const props = createProps(scene);
  const clamp = (p, r = 0.4) => clampToBeach(resolveColliders(p, r, props.colliders));
  return { sky, water, beach, props, clamp, update: t => water.update(t) };
}
