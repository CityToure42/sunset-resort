// 이 파일이 하는 일: 앱이 뜨고 3D 캔버스에 실제로 그림이 그려지는지, 화면 크기 변화를 따라가는지, WebGL이 없을 때 안내가 나오는지 확인
import { test, expect, chromium } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('페이지가 뜨고 캔버스에 그림이 그려진다', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await gotoBeach(page);
  await page.waitForTimeout(800);
  const painted = await page.evaluate(() => window.__app?.paintedPixels ?? 0);
  expect(errors).toEqual([]);
  expect(painted).toBeGreaterThan(1000);
});

test('리사이즈하면 캔버스 크기가 따라온다', async ({ page }) => {
  await gotoBeach(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  const size = await page.evaluate(() => [window.__app.canvasSize.w, window.__app.canvasSize.h]);
  expect(size[0]).toBeGreaterThan(size[1]);
});

test('WebGL이 없으면 안내 문구가 보인다', async () => {
  const browser = await chromium.launch({ args: ['--disable-3d-apis', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/');
  await expect(page.locator('#fatal')).toHaveText('이 브라우저에서는 3D를 켤 수 없어요');
  await browser.close();
});
