// 이 파일이 하는 일: 카메라 리그. 평소엔 캐릭터 뒤를 따라가고(드래그로 회전), 석양멍엔 선베드 뒤 낮은 앵글에 고정, 병 구역을 볼 땐 지정 위치에 고정한다
import * as THREE from 'three';

export const FOLLOW_DISTANCE = 6.5;
export const FOLLOW_HEIGHT = 2.6;

export function createCameraRig(camera) {
  const api = { mode: 'follow', yaw: 0, pitch: 0.32, follow, setZen, setFixed, dragBy, update, position: camera.position };
  const target = new THREE.Vector3(0, 1, 0);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();
  const curLook = new THREE.Vector3(0, 1, 0);
  let followTarget = null;
  let zenT = 0;
  let snap = true;

  function follow(targetVec) {
    followTarget = targetVec;
    if (api.mode !== 'follow') { api.mode = 'follow'; snap = false; }
  }
  function setZen(seatPos, lookAt) {
    api.mode = 'zen';
    wantPos.set(seatPos.x, seatPos.y, seatPos.z);
    wantLook.set(lookAt.x, lookAt.y, lookAt.z);
    zenT = 0;
  }
  function setFixed(pos, lookAt) {
    api.mode = 'fixed';
    wantPos.set(pos.x, pos.y, pos.z);
    wantLook.set(lookAt.x, lookAt.y, lookAt.z);
  }
  function dragBy(dx, dy) {
    if (api.mode !== 'follow') return;
    api.yaw -= dx * 0.005;
    api.pitch = Math.min(1.0, Math.max(0.15, api.pitch + dy * 0.004));
  }

  function update(dt) {
    if (api.mode === 'follow' && followTarget) {
      target.set(followTarget.x, followTarget.y + 1.0, followTarget.z);
      const d = FOLLOW_DISTANCE;
      wantPos.set(
        target.x + Math.sin(api.yaw) * Math.cos(api.pitch) * d,
        target.y + Math.sin(api.pitch) * d,
        target.z + Math.cos(api.yaw) * Math.cos(api.pitch) * d
      );
      wantLook.set(target.x, target.y + 0.4, target.z);   // 캐릭터 머리 위를 보게 해 지평선이 화면 위쪽 1/3에 오도록
    } else if (api.mode === 'zen') {
      zenT += dt;
      // 아주 느리게 좌우로 흔들리는 "멍 때리는" 카메라
      const sway = Math.sin(zenT * 0.25) * 0.04;
      camera.position.lerp(wantPos, Math.min(1, dt * 2));
      curLook.lerp(wantLook, Math.min(1, dt * 2));
      camera.lookAt(curLook.x + sway * 10, curLook.y, curLook.z);
      return;
    }
    const k = snap ? 1 : Math.min(1, dt * 4);
    camera.position.lerp(wantPos, k);
    curLook.lerp(wantLook, k);
    camera.lookAt(curLook);
    snap = false;
  }

  return api;
}
