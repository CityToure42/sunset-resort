// 이 파일이 하는 일: 공유 링크(#b=병id)로 들어오면 그 병 앞 바다로 가서 편지 카드가 열리는지 — 기존 사용자, 처음 온 친구, 없는 병, 이미 열린 앱에서 링크 바꾸기
import { test, expect } from '@playwright/test';
import { gotoBeach, seedProfile, TEST_NOW } from './helpers.mjs';
import { installFakeSupabase } from './fake-supabase.mjs';

const ID = '00000000-0000-4000-8000-0000000000bb';
const ONE = { bottles: [{ id: ID, message: '링크로 왔나요', nickname: '친구', x: 6, z: -16 }] };

test('기존 사용자가 링크로 들어오면 그 병 앞 바다에서 카드가 열린다', async ({ page }) => {
  await installFakeSupabase(page, ONE);
  await seedProfile(page);
  await page.goto('/#b=' + ID);
  await expect(page.locator('#bottle-card .msg')).toHaveText('링크로 왔나요');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('fixed');
  await expect(page.locator('#btn-sea')).toHaveText('돌아가기');
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('처음 온 친구: 진입 화면에서 이름을 정하고 들어가면 카드가 열린다', async ({ page }) => {
  await installFakeSupabase(page, ONE);
  await page.addInitScript(t => { window.__SR_NOW__ = t; window.__SR_QUALITY__ = 'high'; }, TEST_NOW);
  await page.goto('/#b=' + ID);
  await expect(page.locator('#entry')).toBeVisible();
  await expect(page.locator('#bottle-card')).toHaveCount(0);
  await page.fill('#nick', '새친구');
  await page.click('#enter');
  await expect(page.locator('#bottle-card .msg')).toHaveText('링크로 왔나요');
  expect(await page.evaluate(() => location.hash)).toBe('');
});

test('없는 병 링크 → 안내 토스트, 해변은 정상', async ({ page }) => {
  await installFakeSupabase(page, ONE);
  await seedProfile(page);
  await page.goto('/#b=00000000-0000-4000-8000-000000000999');
  await expect(page.locator('#toast')).toHaveText('이 편지는 바다에서 사라졌어요');
  await expect(page.locator('#bottle-card')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
});

test('이상한 링크(#b=abc)는 조용히 무시', async ({ page }) => {
  const fake = await installFakeSupabase(page, ONE);
  await seedProfile(page);
  await page.goto('/#b=abc');
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  await page.waitForTimeout(500);
  expect(fake.state.calls.filter(c => c.fn === 'get_bottle').length).toBe(0);
  await expect(page.locator('#bottle-card')).toHaveCount(0);
});

test('서버가 아프면 "바다 소식을 불러오지 못했어요"', async ({ page }) => {
  await installFakeSupabase(page, { ...ONE, failWith: 500 });
  await seedProfile(page);
  await page.goto('/#b=' + ID);
  await expect(page.locator('#toast')).toHaveText('바다 소식을 불러오지 못했어요');
  await expect(page.locator('#bottle-card')).toHaveCount(0);
});

test('앱이 열려 있을 때 링크(해시)가 바뀌어도 카드가 열린다', async ({ page }) => {
  await gotoBeach(page, {}, { fake: ONE });
  await page.evaluate(id => { location.hash = '#b=' + id; }, ID);
  await expect(page.locator('#bottle-card .msg')).toHaveText('링크로 왔나요');
  expect(await page.evaluate(() => location.hash)).toBe('');
});
