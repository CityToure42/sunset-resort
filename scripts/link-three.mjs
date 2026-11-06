// 이 파일이 하는 일: Node 테스트에서도 import 'three'가 벤더 복사본을 찾도록 node_modules/three 바로가기를 만든다 (브라우저는 importmap이 같은 역할)
import { existsSync, mkdirSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(new URL('..', import.meta.url).pathname);
const link = resolve(root, 'node_modules/three');
if (!existsSync(link)) {
  mkdirSync(resolve(root, 'node_modules'), { recursive: true });
  symlinkSync(resolve(root, 'vendor/three'), link, 'dir');
  console.log('linked node_modules/three -> vendor/three');
}
