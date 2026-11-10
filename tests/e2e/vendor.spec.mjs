// 이 파일이 하는 일: 실시간 라이브러리(supabase-js)가 페이지에 실리고, 그래도 기존 해변 화면은 그대로인지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('라이브러리가 실린다', async ({ page }) => {
  await gotoBeach(page);
  expect(await page.evaluate(() => typeof window.supabase?.createClient)).toBe('function');
});

test('기존 화면은 그대로', async ({ page }) => {
  await gotoBeach(page);
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
});
