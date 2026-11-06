// 이 파일이 하는 일: 폰용 가상 조이스틱. 화면 아무 곳이나 누르면 그 자리에 생기고, 끄는 방향·세기를 {x, y} 벡터(길이 0~1)로 알려준다
export const JOYSTICK_RADIUS = 60;

// 손가락 시작점(origin)과 현재 위치(current)로 방향 벡터 계산. 화면 좌표라 아래가 +y
export function joystickVector(origin, current, radius = JOYSTICK_RADIUS) {
  const dx = current.x - origin.x, dy = current.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return { x: 0, y: 0 };
  const k = Math.min(1, len / radius) / len;
  return { x: dx * k, y: dy * k };
}

export function createJoystick(layerEl) {
  const api = { vector: { x: 0, y: 0 }, active: false, pointerId: null, reset, destroy };
  let origin = null, stickEl = null, knobEl = null;

  function show(x, y) {
    stickEl = document.createElement('div');
    stickEl.className = 'stick';
    stickEl.style.left = x + 'px';
    stickEl.style.top = y + 'px';
    knobEl = document.createElement('div');
    knobEl.className = 'knob';
    stickEl.appendChild(knobEl);
    layerEl.appendChild(stickEl);
  }

  function reset() {
    api.vector = { x: 0, y: 0 };
    api.active = false;
    api.pointerId = null;
    origin = null;
    stickEl?.remove();
    stickEl = knobEl = null;
  }

  function onDown(e) {
    if (api.active) return;
    if (e.target.closest('button, input, a, .panel')) return;   // 버튼 위에서는 조이스틱을 만들지 않는다
    // 조이스틱은 터치의 화면 왼쪽 절반 전용. 오른쪽 절반 터치와 마우스 드래그는 카메라 회전에 쓴다
    if (e.pointerType === 'mouse' || e.clientX > window.innerWidth / 2) return;
    api.active = true;
    api.pointerId = e.pointerId;
    origin = { x: e.clientX, y: e.clientY };
    show(origin.x, origin.y);
    try { layerEl.setPointerCapture(e.pointerId); } catch { /* 테스트용 합성 이벤트는 캡처가 안 될 수 있음 */ }
  }
  function onMove(e) {
    if (!api.active || e.pointerId !== api.pointerId) return;
    api.vector = joystickVector(origin, { x: e.clientX, y: e.clientY });
    if (knobEl) knobEl.style.transform = `translate(${api.vector.x * JOYSTICK_RADIUS}px, ${api.vector.y * JOYSTICK_RADIUS}px)`;
  }
  function onUp(e) {
    if (e.pointerId !== api.pointerId) return;
    reset();
  }

  layerEl.addEventListener('pointerdown', onDown);
  layerEl.addEventListener('pointermove', onMove);
  layerEl.addEventListener('pointerup', onUp);
  layerEl.addEventListener('pointercancel', onUp);
  window.addEventListener('blur', reset);
  // 다른 앱으로 넘어가거나 화면이 꺼질 때(iOS는 blur가 안 올 때가 있다) 눌린 채 남지 않게
  const onHide = () => reset();
  const onVisibility = () => { if (document.visibilityState === 'hidden') reset(); };
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVisibility);

  function destroy() {
    reset();
    layerEl.removeEventListener('pointerdown', onDown);
    layerEl.removeEventListener('pointermove', onMove);
    layerEl.removeEventListener('pointerup', onUp);
    layerEl.removeEventListener('pointercancel', onUp);
    window.removeEventListener('blur', reset);
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
  }
  return api;
}
