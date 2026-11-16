// 이 파일이 하는 일: 장소 규칙 — 어디가 모래·얕은 물·바다·수영장인지, 튜브가 있을 때 갈 수 있는 범위, 조개를 놓아도 되는 자리, 가장 가까운 빈 선베드 고르기. 화면이 없는 순수 규칙
// 갈 수 있는 범위: 모래(z ≥ -9)와 발목 깊이 얕은 물(-12 ≤ z < -9), x는 -30~30, 뒤쪽은 z 40까지 (world.js가 다시 내보낸다)
export const BOUNDS = { xMin: -30, xMax: 30, zMin: -12, zMax: 40 };

export const SHORE_Z = -9.5;        // 해안선(이보다 바다 쪽이면 물)
export const SHALLOW_MIN_Z = -12;   // 튜브 없이 갈 수 있는 끝(발목 깊이)
export const TUBE_MIN_Z = -22;      // 튜브 타고 갈 수 있는 앞바다 끝
export const SEA_X = 28;            // 바다에서의 좌우 끝
export const POOL = { x: 9, z: 14, w: 8, d: 5 };   // 버블풀(중심·가로·세로)
export const TUBE_RACK = { x: -12, z: -7 };
// 선베드 6세트(등받이가 바다 반대편 → 누우면 발끝 너머로 석양)
export const SUNBEDS = [[5.3, 2.0], [1.8, 2.0], [-1.7, 2.6], [8.7, 1.0], [3.5, 6.5], [7.5, 6.5]]
  .map(([x, z]) => Object.freeze({ x, z, ry: Math.PI - 0.45 }));

export function inPool(x, z) {
  return Math.abs(x - POOL.x) <= POOL.w / 2 && Math.abs(z - POOL.z) <= POOL.d / 2;
}

export function placeOf(x, z) {
  if (inPool(x, z)) return 'pool';
  if (z >= SHORE_Z) return 'sand';
  if (z >= SHALLOW_MIN_Z) return 'shallow';
  return 'sea';
}

export function clampFor({ x, z }, { tube = false } = {}) {
  const zc = Math.min(BOUNDS.zMax, Math.max(tube ? TUBE_MIN_Z : SHALLOW_MIN_Z, z));
  const xMax = zc < SHALLOW_MIN_Z ? SEA_X : BOUNDS.xMax;
  return { x: Math.min(xMax, Math.max(-xMax, x)), z: zc };
}

// 조개 같은 걸 놓아도 되는 자리: 수영장 밖이고 모든 소품 원(r + 여유) 밖
export function isFreeSpot(x, z, colliders = [], margin = 0.6) {
  if (inPool(x, z)) return false;
  return colliders.every(c => Math.hypot(x - c.x, z - c.z) > c.r + margin);
}

// 가장 가까운 '빈' 선베드. 석양멍 중인 친구 위치에서 radius 안에 있으면 찬 자리. 다 찼으면 그냥 가장 가까운 자리
export function chooseSunbed(sunbeds, me, taken = [], radius = 1.5) {
  const dist = s => Math.hypot(s.x - me.x, s.z - me.z);
  const byNear = [...sunbeds].sort((a, b) => dist(a) - dist(b));
  const free = byNear.filter(s => !taken.some(t => Math.hypot(t.x - s.x, t.z - s.z) < radius));
  return free[0] ?? byNear[0];
}
