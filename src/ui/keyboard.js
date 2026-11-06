// 이 파일이 하는 일: PC용 키보드 입력. 방향키·WASD를 {x, y} 벡터로 바꿔 준다 (조이스틱과 같은 모양)
const KEYS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };

export function createKeyboard(target = window) {
  const down = new Set();
  const api = { vector: { x: 0, y: 0 }, press, destroy };

  function recompute() {
    let x = 0, y = 0;
    for (const code of down) { const [dx, dy] = KEYS[code]; x += dx; y += dy; }
    const len = Math.hypot(x, y);
    api.vector = len > 1 ? { x: x / len, y: y / len } : { x, y };
  }
  function press(code, isDown) {
    if (!(code in KEYS)) return;
    if (isDown) down.add(code); else down.delete(code);
    recompute();
  }
  // 글자를 입력하는 칸(닉네임·편지)에서는 캐릭터를 움직이지 않고 글자가 그대로 입력되게 한다
  const typing = e => e.isComposing || !!e.target?.closest?.('input, textarea, select, [contenteditable]');
  const onKeyDown = e => { if (e.code in KEYS && !e.repeat && !typing(e)) { press(e.code, true); e.preventDefault(); } };
  const onKeyUp = e => press(e.code, false);
  const onBlur = () => { down.clear(); recompute(); };

  target.addEventListener('keydown', onKeyDown);
  target.addEventListener('keyup', onKeyUp);
  target.addEventListener('blur', onBlur);

  function destroy() {
    target.removeEventListener('keydown', onKeyDown);
    target.removeEventListener('keyup', onKeyUp);
    target.removeEventListener('blur', onBlur);
  }
  return api;
}
