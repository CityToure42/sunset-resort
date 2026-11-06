// 이 파일이 하는 일: Claude 아티팩트(미리보기 링크)로 올릴 수 있게 dist-artifact/ 폴더를 만든다 — index.html에서 문서 뼈대 태그를 벗기고, src·styles.css·vendor를 그대로 복사
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const out = resolve(root, 'dist-artifact');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let html = readFileSync(resolve(root, 'index.html'), 'utf8');
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<body[^>]*>\s*/i, '')
  .replace(/<\/body>\s*/i, '');
// <body data-mode="boot">의 속성은 아티팩트 뼈대가 body를 만들므로, 첫 스크립트에서 옮겨 준다
html = html.replace('<script type="module" src="./src/main.js"></script>', '<script>document.body.dataset.mode = "boot";</script>\n  <script type="module" src="./src/main.js"></script>');
writeFileSync(resolve(out, 'index.html'), html.trim() + '\n');
cpSync(resolve(root, 'src'), resolve(out, 'src'), { recursive: true });
cpSync(resolve(root, 'styles.css'), resolve(out, 'styles.css'));
mkdirSync(resolve(out, 'vendor/three'), { recursive: true });
cpSync(resolve(root, 'vendor/three/three.module.js'), resolve(out, 'vendor/three/three.module.js'));
console.log('built', out);
