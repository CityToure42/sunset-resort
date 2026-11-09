// 이 파일이 하는 일: 놀기 버튼 5개가 동작을 실행하고, 눕기는 움직이면 풀리며, 꾸미기 패널에서 바꾼 셔츠가 저장되는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('놀기 탭을 누르면 동작 버튼 5개가 보인다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="play"]');
  const btns = page.locator('button.emote');
  await expect(btns).toHaveCount(5);
  await expect(btns).toHaveText(['인사', '건배', '춤', '눕기', '비치볼']);
  await page.click('button.tab[data-mode="move"]');
  await expect(page.locator('button.emote')).toHaveCount(0);
});

test('건배를 누르면 cheers가 되고 잠시 뒤 idle로 돌아온다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="play"]');
  await page.click('button.emote[data-emote="cheers"]');
  expect(await page.evaluate(() => window.__app.anim.state)).toBe('cheers');
  await page.waitForFunction(() => window.__app.anim.state === 'idle', null, { timeout: 8000 });
});

test('건배·인사는 하트 이펙트를 띄운다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="play"]');
  await page.click('button.emote[data-emote="wave"]');
  expect(await page.evaluate(() => window.__app.effects.count)).toBeGreaterThan(0);
});

test('비치볼은 공을 던지고 잠시 뒤 사라진다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="play"]');
  await page.click('button.emote[data-emote="throw"]');
  expect(await page.evaluate(() => window.__app.effects.balls)).toBe(1);
  await page.waitForFunction(() => window.__app.effects.balls === 0, null, { timeout: 8000 });
});

test('눕기는 유지되다가 움직이면 풀린다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="play"]');
  await page.click('button.emote[data-emote="lie"]');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__app.anim.state)).toBe('lie');
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(() => window.__app.anim.state === 'walk', null, { timeout: 5000 });
  await page.keyboard.up('ArrowUp');
  await page.waitForFunction(() => window.__app.anim.state === 'idle', null, { timeout: 5000 });
});

test('꾸미기에서 셔츠 3번을 고르면 저장되어 새로고침 후에도 유지', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-customize');
  await expect(page.locator('#customize-panel')).toBeVisible();
  await page.click('#customize-panel [data-shirt="3"]');
  await page.click('#customize-close');
  await expect(page.locator('#customize-panel')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  expect(await page.evaluate(() => window.__app.profile.look.shirt)).toBe(3);
});

test('showToast는 문구를 띄우고 시간이 지나면 숨긴다', async ({ page }) => {
  await gotoBeach(page);
  // 느린 테스트 컴퓨터에서도 '보이는 순간'을 놓치지 않게 1.5초 동안 띄운다
  await page.evaluate(() => window.__app.toast('안녕', 1500));
  await expect(page.locator('#toast')).toBeVisible();
  await expect(page.locator('#toast')).toHaveText('안녕');
  await expect(page.locator('#toast')).toBeHidden({ timeout: 5000 });
});
