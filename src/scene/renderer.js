// 이 파일이 하는 일: 3D를 그려주는 "렌더러"를 만들고(WebGL이 없으면 null), 화면 크기에 맞추고, 테스트용으로 픽셀을 읽는다
import * as THREE from 'three';

export function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: true }) || canvas.getContext('webgl', { antialias: true });
  if (!gl) return null;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
  }
  resize();
  return { renderer, resize };
}

// 화면을 8x8 간격(64x64 샘플)으로 훑어 배경색과 다른 픽셀이 몇 개인지 센다 — "뭔가 그려졌나?" 확인용
export function countPaintedPixels(renderer, bg = [0, 0, 0]) {
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const buf = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  let painted = 0;
  const stepX = Math.max(1, Math.floor(w / 64)), stepY = Math.max(1, Math.floor(h / 64));
  for (let y = 0; y < h; y += stepY) {
    for (let x = 0; x < w; x += stepX) {
      const i = (y * w + x) * 4;
      if (Math.abs(buf[i] - bg[0]) + Math.abs(buf[i + 1] - bg[1]) + Math.abs(buf[i + 2] - bg[2]) > 24) painted++;
    }
  }
  return painted;
}

// 화면의 (가로 비율, 세로 비율) 위치 픽셀 색을 [r,g,b]로 읽는다 (0,0 = 왼쪽 위)
export function samplePixel(renderer, xFrac, yFrac) {
  const gl = renderer.getContext();
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
  const x = Math.min(w - 1, Math.floor(xFrac * w)), y = Math.min(h - 1, Math.floor((1 - yFrac) * h));
  const px = new Uint8Array(4);
  gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return [px[0], px[1], px[2]];
}

// 지금 장면을 한 번 그리고, 그 즉시 2D 캔버스로 복사한다. (preserveDrawingBuffer 없이도 같은 순간에 복사하면 내용이 남아 있다)
export function captureFrame(renderer, scene, camera) {
  renderer.render(scene, camera);
  const src = renderer.domElement;
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  out.getContext('2d').drawImage(src, 0, 0);
  return out;
}
