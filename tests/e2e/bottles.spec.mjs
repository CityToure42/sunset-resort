// 이 파일이 하는 일: 유리병 편지를 쓰고 → 바다에서 위치를 골라 띄우고 → 링크를 받고 → 메시지 보기와 새로고침 후에도 남아 있는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('편지 쓰기 → 위치 고르기 → 띄우기 → 링크 → 메시지 보기 → 새로고침 후에도 유지', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-bottle');
  await expect(page.locator('#bottle-panel')).toBeVisible();
  await expect(page.locator('#bottle-shape button')).toHaveCount(6);
  await page.click('#bottle-shape [data-shape="heart"]');
  await page.fill('#bottle-msg', '석양이 예뻐요');
  await expect(page.locator('#bottle-count')).toHaveText('7/50');
  await page.click('#bottle-next');

  await expect(page.locator('#bottle-pick')).toBeVisible();
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('fixed');
  await page.waitForTimeout(800);
  const vp = page.viewportSize();
  await page.mouse.click(vp.width * 0.3, vp.height * 0.45);
  await page.click('#bottle-place');

  await expect(page.locator('#toast')).toHaveText('편지가 바다에 띄워졌어요');
  await expect(page.locator('#bottle-link')).toHaveValue(/#b=[0-9a-f-]{36}$/);
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(1);
  const b = await page.evaluate(() => window.__app.profile.bottles[0]);
  expect(b.shape).toBe('heart');
  expect(b.message).toBe('석양이 예뻐요');
  expect(b.x).toBeGreaterThanOrEqual(-18); expect(b.x).toBeLessThanOrEqual(18);
  expect(b.z).toBeGreaterThanOrEqual(-24); expect(b.z).toBeLessThanOrEqual(-12);
  await page.click('#bottle-done-close');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('follow');

  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .bottle-item')).toHaveCount(1);
  await expect(page.locator('#messages-panel .bottle-item .msg')).toHaveText('석양이 예뻐요');

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(1);
  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .bottle-item')).toHaveCount(1);
});

test('빈 메시지로 띄우려 하면 안내가 뜬다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-bottle');
  await page.click('#bottle-next');
  await expect(page.locator('#bottle-error')).toHaveText('1~50자로 적어주세요');
  await expect(page.locator('#bottle-pick')).toHaveCount(0);
});

test('위치 고르기에서 취소하면 아무것도 저장되지 않는다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-bottle');
  await page.fill('#bottle-msg', '취소할 편지');
  await page.click('#bottle-next');
  await page.click('#bottle-cancel');
  await expect(page.locator('#bottle-pick')).toHaveCount(0);
  expect(await page.evaluate(() => window.__app.profile.bottles.length)).toBe(0);
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('follow');
});

test('메시지 보기: 편지가 없으면 안내 문구', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .empty')).toHaveText('아직 띄운 편지가 없어요');
  await page.click('#messages-close');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
});

test('바다로 가기 ↔ 돌아가기', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-sea');
  await expect(page.locator('#btn-sea')).toHaveText('돌아가기');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('fixed');
  await page.click('#btn-sea');
  await expect(page.locator('#btn-sea')).toHaveText('바다로 가기');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('follow');
});

test('저장된 병들이 바다에 떠 있는 스크린샷', async ({ page }) => {
  const bottles = ['round', 'tall', 'square', 'jar', 'heart', 'star'].map((shape, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`, shape, message: `편지 ${i}`, x: -9 + i * 3.6, z: -14 - (i % 2) * 3,
    nickname: '테스트', createdAt: '2026-11-05T06:00:00.000Z', likes: 0
  }));
  await gotoBeach(page, { bottles });
  await page.click('#btn-sea');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'tests/e2e/__shots__/bottles-sea.png' });
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(6);
});
