// 이 파일이 하는 일: 해변 바에서 오늘의 칵테일을 하루 5잔 받고, 자정에 초기화되며, 시각에 따라 석양 분위기와 이벤트 안내가 바뀌는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

// KST 시각 → 그 순간을 돌려주는 시계 함수를 페이지에 주입
async function setKst(page, y, mo, d, h, mi) {
  await page.evaluate(([y, mo, d, h, mi]) => {
    const t = Date.UTC(y, mo - 1, d, h - 9, mi);
    window.__app.setNow(() => new Date(t));
  }, [y, mo, d, h, mi]);
}

test('바 근처에서만 "칵테일 받기"가 보이고, 5잔까지 받으면 6번째는 안내', async ({ page }) => {
  await gotoBeach(page);
  await setKst(page, 2026, 11, 5, 15, 0);
  const btn = page.locator('#btn-take');
  await expect(btn).toBeHidden();
  await page.evaluate(() => { const b = window.__app.world.props.points.bar; window.__app.player.teleport(b.x, b.z + 2.2, Math.PI); });
  await expect(btn).toBeVisible();
  await expect(btn).toHaveText('칵테일 받기');
  for (let i = 1; i <= 5; i++) {
    await btn.click();
    await expect(page.locator('#badge-cocktail')).toHaveText(`오늘의 칵테일 ${i}/5`);
  }
  expect(await page.evaluate(() => window.__app.anim.state)).toBe('drink');
  await btn.click();
  await expect(page.locator('#toast')).toHaveText('오늘 칵테일은 다 마셨어요. 내일 또 만나요');
  await expect(page.locator('#badge-cocktail')).toHaveText('오늘의 칵테일 5/5');
});

test('다음 날 00:01이 되면 배지가 0/5로 돌아온다', async ({ page }) => {
  await gotoBeach(page, { cocktails: { date: '2026-11-05', count: 5 } });
  await setKst(page, 2026, 11, 5, 23, 59);
  await expect(page.locator('#badge-cocktail')).toHaveText('오늘의 칵테일 5/5');
  await setKst(page, 2026, 11, 6, 0, 1);
  await expect(page.locator('#badge-cocktail')).toHaveText('오늘의 칵테일 0/5', { timeout: 3000 });
});

test('KST 19:05가 되면 드라마틱 무드와 이벤트 안내, 19:30 이후엔 파스텔', async ({ page }) => {
  await gotoBeach(page);
  await setKst(page, 2026, 11, 5, 15, 0);
  await page.waitForFunction(() => window.__app.currentMood === 'pastel', null, { timeout: 3000 });
  await setKst(page, 2026, 11, 5, 19, 5);
  await page.waitForFunction(() => window.__app.currentMood === 'dramatic', null, { timeout: 1500 });
  await expect(page.locator('#toast')).toHaveText('석양 이벤트가 시작됐어요');
  await expect(page.locator('#badge-event')).toHaveText('석양 이벤트 진행 중');
  await setKst(page, 2026, 11, 5, 19, 31);
  await page.waitForFunction(() => window.__app.currentMood === 'pastel', null, { timeout: 1500 });
  await expect(page.locator('#badge-event')).toHaveText('매일 오후 7시 석양 이벤트');
});

test('18:40에는 골든아워', async ({ page }) => {
  await gotoBeach(page);
  await setKst(page, 2026, 11, 5, 18, 40);
  await page.waitForFunction(() => window.__app.currentMood === 'golden', null, { timeout: 1500 });
});
