// 이 파일이 하는 일: 버블풀 — 수영장과 비눗방울이 있고, 들어가면 가슴까지 잠겨 팔을 젓고, 나오면 원래대로, 경계에서 높이가 튀지 않으며, 느린 폰에선 비눗방울 절반
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

const y = page => page.evaluate(() => window.__app.avatar.group.position.y);

test('수영장이 있다', async ({ page }) => {
  await gotoBeach(page);
  expect(await page.evaluate(() => window.__app.world.props.pool?.bubbleCount)).toBe(40);
});

test('들어가면 잠기고 팔을 젓고 느려진다, 나오면 원래대로', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(9, 14, 0));
  // 느린 테스트 컴퓨터에선 프레임이 적어 서서히 내려가는 데 시간이 더 걸린다 → 고정 시간 대신 될 때까지 기다린다
  await page.waitForFunction(() => window.__app.avatar.group.position.y < -0.7, null, { timeout: 4000 });
  expect(await page.evaluate(() => window.__app.anim.swim)).toBe(true);
  expect(await page.evaluate(() => window.__app.player.speed)).toBeCloseTo(2.5 * 0.6, 5);
  await page.evaluate(() => window.__app.player.teleport(9, 9, 0));
  await page.waitForFunction(() => window.__app.avatar.group.position.y > -0.1, null, { timeout: 4000 });
  expect(await page.evaluate(() => window.__app.anim.swim)).toBe(false);
});

test('수영장 들락날락 부드럽게', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(9, 10.9, 0));   // 수영장 가장자리 바로 밖(z 11.5부터 안)
  await page.waitForTimeout(500);
  // 매 프레임 높이를 기록하며 안으로 걸어 들어간다
  await page.evaluate(() => { window.__ys = []; window.__app.frame.push(() => window.__ys.push(window.__app.avatar.group.position.y)); });
  await page.keyboard.down('ArrowDown');   // 몸이 다 잠길 때까지(최대 8초) 걷는다
  await page.waitForFunction(() => window.__app.avatar.group.position.y < -0.5, null, { timeout: 8000 });
  await page.keyboard.up('ArrowDown');
  const ys = await page.evaluate(() => window.__ys);
  expect(Math.min(...ys)).toBeLessThan(-0.5);   // 정말 들어갔고
  let maxStep = 0;
  for (let i = 1; i < ys.length; i++) maxStep = Math.max(maxStep, Math.abs(ys[i] - ys[i - 1]));
  expect(maxStep).toBeLessThan(0.3);            // 한 프레임에 툭 꺼지지 않는다
});

test('저품질이면 비눗방울 절반', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.forceQuality('low'));
  expect(await page.evaluate(() => window.__app.world.props.pool.bubbleCount)).toBe(20);
});

test('수영장에서도 건배', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(9, 14, 0));
  await page.click('button.tab[data-mode="play"]');
  await page.click('.emote[data-emote="cheers"]');
  expect(await page.evaluate(() => window.__app.anim.state)).toBe('cheers');
});

test('수영장 스크린샷', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(9, 18.5, 0));   // 수영장 뒤쪽 모래에서 바다 쪽을 보며
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__app.player.teleport(9, 14.5, Math.PI));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'tests/e2e/__shots__/pool.png' });
});

test('수영장에서 석양멍 → 선베드 위에 눕고(몸이 묻히지 않음), 끝내면 모래 높이', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(9, 14, 0));
  await page.waitForFunction(() => window.__app.avatar.group.position.y < -0.7, null, { timeout: 4000 });
  await page.click('button.tab[data-mode="zen"]');
  await page.waitForFunction(() => window.__app.avatar.group.position.y > 0.4, null, { timeout: 3000 });
  await page.evaluate(() => { window.__ys = []; window.__app.frame.push(() => window.__ys.push(window.__app.avatar.group.position.y)); });
  await page.click('#zen-end');
  await page.waitForTimeout(800);
  expect(Math.min(...await page.evaluate(() => window.__ys.slice(-10)))).toBeGreaterThan(-0.1);
});
