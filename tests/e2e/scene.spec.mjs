// 이 파일이 하는 일: 3D 장면이 "위는 하늘, 가운데는 바다, 아래는 모래"로 그려지고 무드를 바꾸면 하늘색이 달라지는지 픽셀로 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('위는 하늘, 가운데는 바다, 아래는 모래 색이다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(800);
  // 바다는 태양 반사 줄기를 피해 왼쪽에서 샘플한다
  const [sky, sea, sand] = await page.evaluate(() => [[0.5, 0.08], [0.15, 0.3], [0.5, 0.9]].map(p => window.__app.samplePixel(...p)));
  expect(sea[2]).toBeGreaterThan(sea[0]);               // 바다: 파란 성분이 큼
  expect(sand[0]).toBeGreaterThan(sand[2]);             // 모래: 붉은/노란 성분이 큼
  expect(sky[0] + sky[1] + sky[2]).toBeGreaterThan(sea[0] + sea[1] + sea[2]); // 석양 하늘이 바다보다 밝음
});

test('무드를 바꾸면 하늘 색이 달라진다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(500);
  const before = await page.evaluate(() => window.__app.samplePixel(0.5, 0.08));
  await page.evaluate(() => window.__app.applyMood('dramatic'));
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => window.__app.samplePixel(0.5, 0.08));
  const diff = Math.abs(before[0] - after[0]) + Math.abs(before[1] - after[1]) + Math.abs(before[2] - after[2]);
  expect(diff).toBeGreaterThan(30);
});

test('폰·PC 화면 스크린샷을 남긴다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'tests/e2e/__shots__/scene-phone.png' });
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'tests/e2e/__shots__/scene-desktop.png' });
});
