// 이 파일이 하는 일: 지금 3D 화면을 사진으로 만든다 — 캡처, 왼쪽 아래 워터마크(앱 이름 · 닉네임), PNG 변환, 폰은 공유 시트·PC는 다운로드
import { captureFrame } from '../scene/renderer.js';

export const APP_NAME = 'Sunset Resort';

export function drawWatermark(canvas, label) {
  const g = canvas.getContext('2d');
  const scale = Math.max(1, canvas.width / 400);
  const font = Math.round(13 * scale);
  g.font = `600 ${font}px "Apple SD Gothic Neo", "Noto Sans KR", system-ui, sans-serif`;
  const padX = 10 * scale, padY = 7 * scale, margin = 12 * scale;
  const tw = g.measureText(label).width;
  const bw = tw + padX * 2, bh = font + padY * 2;
  const x = margin, y = canvas.height - margin - bh;
  // 어떤 배경에서도 읽히도록 반투명 어두운 알약 위에 흰 글씨
  g.fillStyle = 'rgba(23, 26, 43, 0.55)';
  g.beginPath();
  g.roundRect ? g.roundRect(x, y, bw, bh, bh / 2) : g.rect(x, y, bw, bh);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textBaseline = 'middle';
  g.fillText(label, x + padX, y + bh / 2 + scale);
}

export async function takePhoto({ renderer, scene, camera, nickname, appName = APP_NAME }) {
  const canvas = captureFrame(renderer, scene, camera);
  const label = nickname ? `${appName} · ${nickname}` : appName;
  drawWatermark(canvas, label);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  return { blob, canvas, label };
}

export async function sharePhoto(blob, filename) {
  const file = new File([blob], filename, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: APP_NAME }); return 'shared'; }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled'; /* 공유 실패 → 아래 다운로드로 */ }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}

export function photoFilename(date = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `sunset-resort-${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}.png`;
}
