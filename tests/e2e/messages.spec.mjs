// 이 파일이 하는 일: 메시지 보기 — 내가 띄운 병의 ♥·답글·숨겨짐 표시, 새 답글이 오면 탭에 빨간 점, 보면 사라짐, 서버 실패 안내, 답글 글자만 보이기
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

const ME = '11111111-2222-4333-8444-555555555555';
const A = '00000000-0000-4000-8000-0000000000a1';
const B = '00000000-0000-4000-8000-0000000000b2';

test('내 병 목록: ♥·답글 수, 숨겨짐 태그, 답글 내용', async ({ page }) => {
  const fake = await gotoBeach(page, {}, { fake: { bottles: [
    { id: A, owner_token: ME, message: '숨겨진 편지', reports: 3 },
    { id: B, owner_token: ME, message: '답글 받은 편지', likes: 4, x: 3 },
    { message: '남의 편지', x: -3 }
  ] } });
  fake.addReply(B, { nickname: '친구하나', message: '예뻐요' });
  fake.addReply(B, { nickname: '친구둘', message: '나도 봤어요' });
  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .bottle-item')).toHaveCount(2);
  await expect(page.locator('#messages-panel .hidden-tag')).toHaveCount(1);
  const b = page.locator('#messages-panel .bottle-item', { hasText: '답글 받은 편지' });
  await expect(b.locator('.meta')).toContainText('♥ 4 · 답글 2');
  await expect(b.locator('.reply')).toHaveCount(2);
  await expect(b.locator('.reply').first()).toContainText('예뻐요');
  await expect(page.locator('#messages-panel .bottle-item', { hasText: '숨겨진 편지' }).locator('.hidden-tag')).toHaveText('숨겨짐');
});

test('새 답글 → 메시지 탭에 빨간 점, 열어 보면 사라지고 새로고침해도 없다', async ({ page }) => {
  const fake = await gotoBeach(page, {}, { fake: { bottles: [{ id: B, owner_token: ME, message: '내 편지' }] } });
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await expect(page.locator('button.tab[data-mode="messages"] .dot')).toHaveCount(0);
  fake.addReply(B, { message: '새 답글' });
  await page.evaluate(() => window.__app.refreshSea());
  await expect(page.locator('button.tab[data-mode="messages"] .dot')).toHaveCount(1);
  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .reply')).toHaveCount(1);
  await expect(page.locator('button.tab[data-mode="messages"] .dot')).toHaveCount(0);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  await page.evaluate(() => window.__app.refreshSea());
  await expect(page.locator('button.tab[data-mode="messages"] .dot')).toHaveCount(0);
});

test('답글에 태그가 있어도 글자로만', async ({ page }) => {
  const evil = '<img src=x onerror="window.__pwned=1">';
  const fake = await gotoBeach(page, {}, { fake: { bottles: [{ id: B, owner_token: ME, message: '내 편지' }] } });
  fake.addReply(B, { nickname: '<b>z</b>', message: evil });
  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .reply')).toContainText(evil);
  expect(await page.locator('#messages-panel img, #messages-panel b').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('서버가 아프면 메시지 보기에 안내', async ({ page }) => {
  await gotoBeach(page, {}, { fake: { failWith: 500 } });
  await page.click('button.tab[data-mode="messages"]');
  await expect(page.locator('#messages-panel .empty')).toHaveText('바다 소식을 불러오지 못했어요');
});
