// 이 파일이 하는 일: 입력 벡터를 받아 캐릭터를 카메라 기준 방향으로 움직이고(속도 2.5), 몸을 그쪽으로 돌리며, 갈 수 없는 곳은 world.clamp로 막는다
import * as THREE from 'three';

export const PLAYER_SPEED = 2.5;
export const MAX_DT = 0.05;
export const PLAYER_RADIUS = 0.4;

export function createPlayer({ avatar, anim, world, speed = PLAYER_SPEED }) {
  const position = avatar.group.position;   // 캐릭터의 실제 위치와 같은 객체를 공유
  const api = { position, heading: 0, speed, step, teleport, avatar, anim };

  // input: {x: 좌우(-1~1), y: 앞뒤(-1=앞, 1=뒤)}, camYaw: 카메라가 바라보는 수평 각도
  function step(dt, input, camYaw = 0) {
    dt = Math.min(dt, MAX_DT);
    const ix = input?.x ?? 0, iy = input?.y ?? 0;
    const len = Math.hypot(ix, iy);
    if (len > 0.01) {
      // 화면 기준 입력을 월드 방향으로: 카메라가 yaw만큼 돌아 있으면 '앞'도 그만큼 돌아간다
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);   // 앞 방향
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);    // 오른쪽 방향
      const dx = fx * -iy + rx * ix, dz = fz * -iy + rz * ix;
      const mag = Math.min(1, len);
      const next = { x: position.x + dx * speed * dt, z: position.z + dz * speed * dt };
      const clamped = world.clamp(next, PLAYER_RADIUS);
      position.x = clamped.x;
      position.z = clamped.z;
      api.heading = Math.atan2(dx, dz);
      avatar.group.rotation.y = api.heading;
      anim.setMoving(mag > 0.01);
    } else {
      anim.setMoving(false);
    }
    anim.update(dt);
  }

  function teleport(x, z, heading = api.heading) {
    position.x = x; position.z = z;
    api.heading = heading;
    avatar.group.rotation.y = heading;
  }

  return api;
}

