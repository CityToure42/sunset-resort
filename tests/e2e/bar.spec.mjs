// 이 파일이 하는 일: 조개와 바 — 처음엔 빈손·🐚 3, 조개 줍기 +1, 바에서 모히또 사서 세 모금, 조개 부족 안내, 연타해도 한 잔, 옛 프로필, 석양멍 보상
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

const toBar = page => page.evaluate(() => { const b = window.__app.world.props.points.bar; window.__app.player.teleport(b.x, b.z + 2.2, Math.PI); });

test('처음엔 빈손·🐚 3', async ({ page }) => {
  await gotoBeach(page);
  await expect(page.locator('#badge-shells')).toHaveText('🐚 3');
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(false);
});

test('조개를 주우면 +1', async ({ page }) => {
  await gotoBeach(page);
  // 조개는 무작위 자리라 가끔 두 개가 0.8m 안에 붙어 있을 수 있다 → 그 자리에서 주울 개수를 세어 기대값으로
  const near = await page.evaluate(() => { const ps = window.__app.resort.shells.positions(); const p = ps[0]; window.__app.player.teleport(p.x, p.z); return ps.filter(q => Math.hypot(q.x - p.x, q.z - p.z) <= 0.8).length; });
  await expect(page.locator('#badge-shells')).toHaveText(`🐚 ${3 + near}`);
  await expect(page.locator('#toast')).toHaveText(`+${near} 🐚`);
  expect(await page.evaluate(() => window.__app.profile.shells)).toBe(3 + near);
});

test('바에서 모히또 사기 → 마시기 3번 → 빈손', async ({ page }) => {
  await gotoBeach(page);
  await toBar(page);
  await expect(page.locator('#btn-take')).toHaveText('칵테일 사기');
  await page.click('#btn-take');
  await expect(page.locator('#bar-menu [data-menu]')).toHaveCount(4);
  await page.click('#bar-menu [data-menu="3"]');
  await expect(page.locator('#bar-menu')).toHaveCount(0);
  await expect(page.locator('#badge-shells')).toHaveText('🐚 0');
  await expect(page.locator('#toast')).toHaveText('모히또 한 잔 받았어요');
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(true);
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.getObjectByName('liquid').material.color.getHexString())).toBe('9ad17f');
  await page.click('button.tab[data-mode="play"]');
  const drinkBtn = page.locator('.emote[data-emote="drink"]');
  await expect(drinkBtn).toBeVisible();
  for (let i = 0; i < 3; i++) { await drinkBtn.click(); await page.waitForTimeout(300); }
  // 마지막 모금은 마시는 동작(1.5초)이 끝난 뒤에 빈손이 된다
  await expect.poll(() => page.evaluate(() => window.__app.avatar.parts.cocktail.visible), { timeout: 3000 }).toBe(false);
  expect(await page.evaluate(() => window.__app.profile.drink)).toBe(null);
  await expect(drinkBtn).toBeHidden();
});

test('조개 부족 안내', async ({ page }) => {
  await gotoBeach(page, { shells: 2 });
  await toBar(page);
  await page.click('#btn-take');
  await page.click('#bar-menu [data-menu="0"]');
  await expect(page.locator('#bar-menu .menu-row:has([data-menu="0"]) .error')).toHaveText('조개가 3개 필요해요');
  await expect(page.locator('#badge-shells')).toHaveText('🐚 2');
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(false);
});

test('들고 있으면 메뉴판에 안내', async ({ page }) => {
  await gotoBeach(page, { shells: 6, drink: { cocktail: 1, sips: 2 } });
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(true);
  await toBar(page);
  await page.click('#btn-take');
  await expect(page.locator('#bar-menu .note')).toHaveText('들고 있는 잔은 사라져요');
});

test('메뉴 연타해도 한 번만', async ({ page }) => {
  await gotoBeach(page, { shells: 6 });
  await toBar(page);
  await page.click('#btn-take');
  await page.dblclick('#bar-menu [data-menu="0"]');
  await page.waitForTimeout(300);
  await expect(page.locator('#badge-shells')).toHaveText('🐚 3');
});

test('옛 프로필로 들어와도 조개 3·빈손', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await gotoBeach(page, { look: { hat: 'straw', glasses: true, shirt: 1, cocktail: 2 }, cocktails: { date: '2026-11-05', count: 4 } });
  await expect(page.locator('#badge-shells')).toHaveText('🐚 3');
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(false);
  expect(errors).toEqual([]);
});

test('석양멍 60초 → +1', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="zen"]');
  await page.evaluate(() => window.__app.resort.tickZen(60));
  expect(await page.evaluate(() => window.__app.profile.shells)).toBe(4);
  await page.click('#zen-end').catch(() => {});
});

test('조개는 저장된다', async ({ page }) => {
  await gotoBeach(page);
  // 조개는 무작위 자리라 가끔 두 개가 0.8m 안에 붙어 있을 수 있다 → 그 자리에서 주울 개수를 세어 기대값으로
  const near = await page.evaluate(() => { const ps = window.__app.resort.shells.positions(); const p = ps[0]; window.__app.player.teleport(p.x, p.z); return ps.filter(q => Math.hypot(q.x - p.x, q.z - p.z) <= 0.8).length; });
  await expect(page.locator('#badge-shells')).toHaveText(`🐚 ${3 + near}`);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  await expect(page.locator('#badge-shells')).toHaveText(`🐚 ${3 + near}`);
});

test('저품질이면 조개 반짝임을 끈다', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.forceQuality('low'));
  expect(await page.evaluate(() => window.__app.scene.children.filter(o => o.userData.sparkle).every(o => o.userData.sparkle.visible === false))).toBe(true);
});

test('마지막 모금: 마시는 동작이 끝난 뒤에 잔이 사라진다, 그사이 새로 사면 새 잔은 남는다', async ({ page }) => {
  await gotoBeach(page, { shells: 3, drink: { cocktail: 0, sips: 1 } });
  await page.evaluate(() => window.__app.resort.drink());
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(true);   // 막 마시기 시작 — 아직 손에
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(false);
  // 다시: 마지막 모금 직후 곧바로 새로 사면 새 잔은 사라지지 않는다
  await page.evaluate(() => { window.__app.profile.drink = { cocktail: 0, sips: 1 }; window.__app.resort.applyDrink(); window.__app.resort.drink(); window.__app.resort.buy(2); });
  await page.waitForTimeout(1800);
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(true);
  expect(await page.evaluate(() => window.__app.profile.drink)).toEqual({ cocktail: 2, sips: 3 });
});
