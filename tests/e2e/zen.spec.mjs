// 이 파일이 하는 일: 석양멍 모드에 들어가면 HUD가 사라지고 카메라·캐릭터가 석양을 보며, 시간이 쌓이고, 끝내기로 돌아오는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('석양멍: 들어가면 HUD가 숨고 문구·카메라·눕기, 시간이 쌓이고, 끝내면 돌아온다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="zen"]');
  await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#zen')).toBeVisible();
  await expect(page.locator('#zen .zen-line')).toHaveText('석양이 지는 동안, 아무것도 하지 않아도 괜찮아요');
  await expect(page.locator('#zen-end')).toHaveText('석양멍 끝내기');
  await expect(page.locator('#zen-time')).toHaveText('잠시');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('zen');
  expect(await page.evaluate(() => window.__app.anim.state)).toBe('lie');

  await page.waitForTimeout(3100);
  expect(await page.evaluate(() => window.__app.profile.zenSeconds)).toBeGreaterThanOrEqual(2);

  await page.click('#zen-end');
  await expect(page.locator('#zen')).toBeHidden();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('follow');
  expect(await page.evaluate(() => window.__app.anim.state)).toBe('idle');
});

test('석양멍 시간은 새로고침 후에도 누적되어 있다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="zen"]');
  await page.waitForTimeout(2200);
  await page.click('#zen-end');
  const before = await page.evaluate(() => window.__app.profile.zenSeconds);
  expect(before).toBeGreaterThanOrEqual(2);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  expect(await page.evaluate(() => window.__app.profile.zenSeconds)).toBe(before);
});

test('파도 소리는 기본 꺼짐이고 버튼으로 켜고 끌 수 있다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="zen"]');
  const btn = page.locator('#zen-sound');
  await expect(btn).toHaveText('파도 소리 켜기');
  await btn.click();
  await expect(btn).toHaveText('파도 소리 끄기');
  expect(await page.evaluate(() => window.__app.waveSound.playing)).toBe(true);
  await btn.click();
  await expect(btn).toHaveText('파도 소리 켜기');
  expect(await page.evaluate(() => window.__app.waveSound.playing)).toBe(false);
});

test('석양멍 화면 스크린샷', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="zen"]');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: 'tests/e2e/__shots__/zen-phone.png' });
});
