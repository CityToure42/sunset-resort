// 이 파일이 하는 일: 첫 진입 화면(닉네임·꾸미기)과 메인 HUD(칩·배지·탭)가 약속대로 동작하는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';
import { installFakeSupabase } from './fake-supabase.mjs';

// 진짜 서버로 나가지 않게 가짜 Supabase를 먼저 끼운다(gotoBeach를 쓰는 테스트는 거기서 다시 끼운 것이 우선)
test.beforeEach(async ({ page }) => { await installFakeSupabase(page); });

test('첫 방문: 추천 닉네임이 채워져 있고, 짧은 이름은 거부, 정상 이름이면 해변으로', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#entry')).toBeVisible();
  const nick = page.locator('#nick');
  await expect(nick).toHaveValue(/^\S+ \S+$/);
  await nick.fill('a');
  await page.click('#enter');
  await expect(page.locator('#nick-error')).toHaveText('2~10자로 적어주세요');
  await nick.fill('hi!');
  await page.click('#enter');
  await expect(page.locator('#nick-error')).toHaveText('한글·영문·숫자만 쓸 수 있어요');
  await nick.fill('세민');
  await page.click('#enter');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
  await expect(page.locator('#chip-nick')).toHaveText('세민');
  await expect(page.locator('#entry')).toBeHidden();
});

test('"다른 이름 추천"을 누르면 닉네임 칸이 바뀐다', async ({ page }) => {
  await page.goto('/');
  const before = await page.inputValue('#nick');
  let changed = false;
  for (let i = 0; i < 8 && !changed; i++) {
    await page.click('#nick-shuffle');
    changed = (await page.inputValue('#nick')) !== before;
  }
  expect(changed).toBe(true);
});

test('저장된 닉네임이 있으면 진입 화면 없이 바로 메인', async ({ page }) => {
  await gotoBeach(page, { nickname: '세민' });
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('#chip-nick')).toHaveText('세민');
  await expect(page.locator('#badge-cocktail')).toHaveText('오늘의 칵테일 0/5');
  await expect(page.locator('#badge-event')).toHaveText('매일 오후 7시 석양 이벤트');
});

test('탭 5개를 누르면 data-mode가 바뀐다', async ({ page }) => {
  await gotoBeach(page);
  const tabs = page.locator('button.tab');
  await expect(tabs).toHaveCount(5);
  await expect(page.locator('button.tab .tab-label')).toHaveText(['이동하기', '놀기', '석양멍하기', '메시지 보기', '사진찍기']);
  for (const mode of ['play', 'messages', 'move', 'zen']) {
    await page.click(`button.tab[data-mode="${mode}"]`);
    await expect(page.locator('body')).toHaveAttribute('data-mode', mode);
  }
  // 석양멍에서는 탭이 숨겨지므로 '석양멍 끝내기'로 빠져나온다
  await expect(page.locator('#hud')).toBeHidden();
  await page.click('#zen-end');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
});

test('진입 화면에서 꾸민 셔츠 색이 저장되어 새로고침 후에도 유지', async ({ page }) => {
  await page.goto('/');
  await page.fill('#nick', '세민');
  await page.click('[data-shirt="3"]');
  await page.click('#enter');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  const shirt = await page.evaluate(() => window.__app.profile.look.shirt);
  expect(shirt).toBe(3);
});
