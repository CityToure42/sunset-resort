// 이 파일이 하는 일: 꾸미기에서 표정을 고르면 캐릭터에 반영되고 새로고침해도 남는지, 꾸미기에 칵테일 고르기가 없어졌는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('표정을 고르면 바뀌고 새로고침해도 남는다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-customize');
  await expect(page.locator('#customize-panel [data-group="face"] button')).toHaveCount(6);
  await page.click('#customize-panel [data-face="heart"]');
  expect(await page.evaluate(() => window.__app.avatar.parts.faces.heart.visible)).toBe(true);
  expect(await page.evaluate(() => window.__app.avatar.parts.faces.smile.visible)).toBe(false);
  await expect(page.locator('#customize-panel [data-face="heart"]')).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  expect(await page.evaluate(() => window.__app.avatar.parts.faces.heart.visible)).toBe(true);
});

test('꾸미기에 칵테일 고르기는 없다·처음엔 빈손', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-customize');
  await expect(page.locator('#customize-panel [data-cocktail]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__app.avatar.parts.cocktail.visible)).toBe(false);
});

test('표정 버튼에 이름이 있다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-customize');
  const labels = await page.locator('#customize-panel [data-group="face"] button').allTextContents();
  expect(labels).toEqual(['기본 미소', '땡그란 눈', '활짝 웃음', '윙크', '하트 눈', '졸린 눈']);
});
