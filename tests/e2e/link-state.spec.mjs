// 이 파일이 하는 일: 실시간이 끊겨도 괜찮은지 — 끊김 배지·혼자 걷기·자동 재연결 뒤 중복 없음, 라이브러리를 못 불러와도 앱이 열리는지
import { test, expect } from '@playwright/test';
import { openTwo } from './two.mjs';
import { installFakeSupabase } from './fake-supabase.mjs';
import { seedProfile } from './helpers.mjs';

test('끊김 배지·재연결·중복 없음', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await a.waitForFunction(() => window.__app.people.count() === 1);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.bringToFront();
  await a.evaluate(() => { window.__rtFake.failNext(1); window.__rtFake.drop(); });
  await expect(a.locator('#chip-link')).toHaveText('연결이 끊겼어요 · 다시 연결 중');
  await expect(a.locator('#chip-people')).toBeHidden();
  // 끊긴 동안에도 혼자 걷기는 된다
  const z0 = await a.evaluate(() => window.__app.player.position.z);
  await a.keyboard.down('ArrowUp'); await a.waitForTimeout(800); await a.keyboard.up('ArrowUp');
  expect(await a.evaluate(() => window.__app.player.position.z)).toBeLessThan(z0 - 0.1);
  // 1초 뒤 시도는 실패(failNext), 2초 뒤 다시 시도해서 붙는다
  await expect(a.locator('#chip-link')).toBeHidden({ timeout: 6000 });
  await a.waitForFunction(() => window.__app.people.count() === 1, null, { timeout: 4000 });
  await b.waitForTimeout(500);
  expect(await b.evaluate(() => window.__app.people.count())).toBe(1);
  expect(await a.evaluate(() => window.__app.people.count())).toBe(1);
  await expect(a.locator('#chip-people')).toHaveText('지금 2명이 함께 있어요');
  await context.close();
});

test('라이브러리를 못 불러와도 앱이 열리고, 실서버로 나가지 않는다', async ({ page }) => {
  const realtimeCalls = [];
  page.on('request', r => { if (/supabase\.co\/realtime/.test(r.url())) realtimeCalls.push(r.url()); });
  await page.addInitScript(() => { window.__SR_RT__ = 'real'; });   // 테스트 기본(off) 대신 진짜 경로
  await page.route('**/vendor/supabase/supabase.js', r => r.abort());
  await installFakeSupabase(page);
  await seedProfile(page);
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  await expect(page.locator('#chip-link')).toHaveText('함께 보기를 켤 수 없어요');
  await expect(page.locator('#chat-btn')).toHaveCount(0);
  expect(await page.evaluate(() => window.__app.realtime.status)).toBe('disabled');
  const z0 = await page.evaluate(() => window.__app.player.position.z);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(800); await page.keyboard.up('ArrowUp');
  expect(await page.evaluate(() => window.__app.player.position.z)).toBeLessThan(z0 - 0.1);
  expect(realtimeCalls).toEqual([]);
});
