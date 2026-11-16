// 이 파일이 하는 일: 튜브 — 없으면 얕은 물 끝(−12)에서 멈추고 안내, 거치대에서 빌리면 앞바다까지 둥둥, 바다에선 반납 버튼 없음, 바다에서 석양멍, 반납, 새로고침해도 유지
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

const toRack = page => page.evaluate(() => window.__app.player.teleport(-12, -5.6, Math.PI));
// 바다 쪽으로 걷다가 z가 untilZ보다 작아지면(최대 8초) 그 뒤 extraMs만 더 걷고 멈춘다. 고정 시간 대신 조건을 기다려 느린 기기에서도 흔들리지 않게
const walkSea = async (page, untilZ, extraMs = 0) => {
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(z => window.__app.player.position.z < z, untilZ, { timeout: 8000 });
  if (extraMs) await page.waitForTimeout(extraMs);
  await page.keyboard.up('ArrowUp');
};
const z = page => page.evaluate(() => window.__app.player.position.z);

async function rent(page, kind = 'flamingo') {
  await toRack(page);
  await expect(page.locator('#btn-tube')).toHaveText('튜브 빌리기');
  await page.click('#btn-tube');
  await page.click(`#tube-picker [data-tube="${kind}"]`);
  await expect(page.locator('#tube-picker')).toHaveCount(0);
}

test('튜브 없이는 −12에서 멈추고 안내', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(0, -11, Math.PI));
  await walkSea(page, -11.9, 600);   // 경계까지 간 뒤에도 더 밀어 본다
  expect(await z(page)).toBeGreaterThanOrEqual(-12.001);
  await expect(page.locator('#toast')).toHaveText('튜브를 빌리면 더 나갈 수 있어요');
});

test('튜브 빌려 앞바다로', async ({ page }) => {
  await gotoBeach(page);
  await rent(page);
  expect(await page.evaluate(() => window.__app.avatar.parts.tube.visible)).toBe(true);
  expect(await page.evaluate(() => window.__app.profile.tube)).toBe('flamingo');
  await page.evaluate(() => window.__app.player.teleport(0, -11, Math.PI));
  // 고정 시간 대신 앞바다(−13)를 넘을 때까지 걷는다(느린 테스트 기기에서도 흔들리지 않게)
  await walkSea(page, -13);
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__app.anim.baseY)).toBeLessThan(-0.4);
  expect(await page.evaluate(() => window.__app.player.speed)).toBeCloseTo(2.5 * 0.7, 5);
});

test('바다에서는 반납 버튼이 없다', async ({ page }) => {
  await gotoBeach(page, { tube: 'donut' });
  await page.evaluate(() => window.__app.player.teleport(-12, -15, Math.PI));
  await page.waitForTimeout(500);
  await expect(page.locator('#btn-tube')).toBeHidden();
});

test('바다에서 석양멍 → 선베드로, 튜브는 그대로', async ({ page }) => {
  await gotoBeach(page, { tube: 'donut' });
  await page.evaluate(() => window.__app.player.teleport(0, -15, Math.PI));
  await page.waitForTimeout(300);
  await page.click('button.tab[data-mode="zen"]');
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => {
    const p = window.__app.player.position;
    return Math.min(...window.__app.world.props.points.sunbeds.map(s => Math.hypot(s.x - p.x, s.z - p.z)));
  });
  expect(d).toBeLessThan(1.5);
  expect(await page.evaluate(() => window.__app.profile.tube)).toBe('donut');
});

test('반납하면 튜브가 사라지고 다시 −12에서 멈춤', async ({ page }) => {
  await gotoBeach(page, { tube: 'watermelon' });
  await toRack(page);
  await expect(page.locator('#btn-tube')).toHaveText('튜브 반납');
  await page.click('#btn-tube');
  expect(await page.evaluate(() => window.__app.avatar.parts.tube.visible)).toBe(false);
  expect(await page.evaluate(() => window.__app.profile.tube)).toBe(null);
  await page.evaluate(() => window.__app.player.teleport(0, -11, Math.PI));
  await walkSea(page, -11.9, 600);
  expect(await z(page)).toBeGreaterThanOrEqual(-12.001);
});

test('새로고침해도 튜브 유지', async ({ page }) => {
  await gotoBeach(page);
  await rent(page, 'donut');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  expect(await page.evaluate(() => window.__app.avatar.parts.tube.userData.type)).toBe('donut');
  await page.evaluate(() => window.__app.player.teleport(0, -11, Math.PI));
  await walkSea(page, -12.5);   // 튜브가 있어야만 −12(얕은 물 끝)를 넘을 수 있다
});

test('튜브 타고 바다에서 석양멍 → 선베드 위 높이에 눕는다', async ({ page }) => {
  await gotoBeach(page, { tube: 'donut' });
  await page.evaluate(() => window.__app.player.teleport(0, -15, Math.PI));
  await page.waitForFunction(() => window.__app.anim.baseY < -0.4, null, { timeout: 4000 });
  await page.click('button.tab[data-mode="zen"]');
  await page.waitForFunction(() => window.__app.avatar.group.position.y > 0.4, null, { timeout: 3000 });
});
