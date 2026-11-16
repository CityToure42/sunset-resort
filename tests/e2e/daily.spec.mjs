// 이 파일이 하는 일: 시각에 따라 석양 분위기와 이벤트 안내가 바뀌는지 확인 (칵테일은 D단계부터 bar.spec.mjs)
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

// KST 시각 → 그 순간을 돌려주는 시계 함수를 페이지에 주입
async function setKst(page, y, mo, d, h, mi) {
  await page.evaluate(([y, mo, d, h, mi]) => {
    const t = Date.UTC(y, mo - 1, d, h - 9, mi);
    window.__app.setNow(() => new Date(t));
  }, [y, mo, d, h, mi]);
}

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
