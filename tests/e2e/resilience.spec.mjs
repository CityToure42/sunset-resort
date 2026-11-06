// 이 파일이 하는 일: 저장이 막힌 브라우저에서도 앱이 돌아가며 안내가 뜨는지, 그래픽 품질을 낮추는 장치가 실제로 그림자·파도를 줄이는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('저장이 막혀 있으면 "이번엔 저장이 안 돼요" 안내 후에도 해변은 정상', async ({ page }) => {
  await page.addInitScript(() => {
    window.__SR_QUALITY__ = 'high';
    Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
  });
  await page.goto('/');
  await page.fill('#nick', '세민');
  await page.click('#enter');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
  await expect(page.locator('#toast')).toHaveText('이번엔 저장이 안 돼요');
  expect(await page.evaluate(() => window.__app.storage.isPersistent)).toBe(false);
  await expect(page.locator('#chip-nick')).toHaveText('세민');
});

test("forceQuality('low')면 그림자가 꺼지고 파도 칸이 35로 줄어든다", async ({ page }) => {
  await gotoBeach(page);
  expect(await page.evaluate(() => window.__app.water.segments)).toBe(70);
  await page.evaluate(() => window.__app.forceQuality('low'));
  expect(await page.evaluate(() => window.__app.water.segments)).toBe(35);
  expect(await page.evaluate(() => window.__app.sky.sunLight.castShadow)).toBe(false);
  expect(await page.evaluate(() => window.__app.quality)).toBe('low');
  await expect(page.locator('#toast')).toHaveText('부드럽게 보이도록 그래픽을 낮췄어요');
});

test('품질을 고정하지 않으면 3초쯤 뒤 한 번 스스로 정한다', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => { delete window.__SR_QUALITY__; window.__app.resetQuality(); });
  expect(await page.evaluate(() => window.__app.quality)).toBe(null);
  await page.waitForFunction(() => window.__app.quality === 'high' || window.__app.quality === 'low', null, { timeout: 10000 });
});
