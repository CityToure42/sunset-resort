// 이 파일이 하는 일: 브라우저 자동 테스트(Playwright) 설정 — 테스트 서버, 폰 크기 화면, WebGL 소프트웨어 렌더링 플래그
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  webServer: { command: 'npm run serve', port: 4173, reuseExistingServer: true },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
  }
});
