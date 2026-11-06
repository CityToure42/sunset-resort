// 이 파일이 하는 일: 앱의 출발점. 렌더러를 만들고(실패하면 안내), 저장소를 열고, createApp으로 전체를 조립한다. 테스트가 볼 값은 window.__app에 둔다
import { createRenderer } from './scene/renderer.js';
import { createStorage } from './state/storage.js';
import { createApp } from './app.js';

const canvas = document.getElementById('c');
const fatal = document.getElementById('fatal');
const r = createRenderer(canvas);

if (!r) {
  fatal.textContent = '이 브라우저에서는 3D를 켤 수 없어요';
  fatal.hidden = false;
} else {
  try {
    const storage = createStorage();
    const app = createApp({ renderer: r.renderer, resize: r.resize, canvas, storage });
    app.storage = storage;
    window.__app = app;
  } catch (e) {
    // 어떤 이유로든 조립에 실패하면 검은 화면 대신 안내를 보여준다
    console.error(e);
    fatal.textContent = '앱을 여는 중 문제가 생겼어요. 새로고침해 주세요';
    fatal.hidden = false;
  }
}
