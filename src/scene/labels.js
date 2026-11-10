// 이 파일이 하는 일: 머리 위에 띄우는 글자 — 닉네임표와 채팅 말풍선을 캔버스에 그려 3D 스프라이트로 만든다
// 글자는 캔버스 fillText로 "그림"이 되므로, 누가 <img onerror=...> 같은 글을 보내도 HTML로 해석될 일이 없다
import * as THREE from 'three';

const STYLE = {
  nick: { font: '600 30px system-ui, sans-serif', bg: 'rgba(23, 26, 43, 0.72)', fg: '#ffffff', pad: 14, h: 46, scale: 0.0075 },
  bubble: { font: '500 30px system-ui, sans-serif', bg: 'rgba(255, 255, 255, 0.95)', fg: '#1d2033', pad: 18, h: 54, scale: 0.0085 }
};

export function makeLabel(text, kind = 'nick') {
  const st = STYLE[kind] ?? STYLE.nick;
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = st.font;
  const w = Math.min(900, Math.ceil(g.measureText(text).width) + st.pad * 2);
  c.width = w; c.height = st.h + (kind === 'bubble' ? 12 : 0);
  g.font = st.font;   // 크기를 바꾸면 글꼴이 초기화되므로 다시 정한다
  g.fillStyle = st.bg;
  const r = st.h / 2;
  g.beginPath();
  g.roundRect(0, 0, w, st.h, r);
  if (kind === 'bubble') { g.moveTo(w / 2 - 10, st.h); g.lineTo(w / 2, st.h + 12); g.lineTo(w / 2 + 10, st.h); }   // 말풍선 꼬리
  g.fill();
  g.fillStyle = st.fg;
  g.textBaseline = 'middle';
  g.textAlign = 'center';
  g.fillText(text, w / 2, st.h / 2 + 1, w - st.pad);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(c.width * st.scale, c.height * st.scale, 1);
  s.renderOrder = 10;
  s.userData.text = text;
  s.userData.kind = kind;
  s.userData.dispose = () => { tex.dispose(); mat.dispose(); };   // 지울 때 GPU 메모리도 돌려준다
  return s;
}
