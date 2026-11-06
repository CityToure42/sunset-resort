// 이 파일이 하는 일: 폭이 좁은 폰(320~360px)에서도 진입 화면·HUD·시트가 화면 밖으로 삐져나가 가로 스크롤이 생기지 않는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

const overflowing = page => page.evaluate(() => {
  const vw = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll('#entry *, #hud *, #panels *')) {
    if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 0.5 || r.left < -0.5)) bad.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${el.className} right=${Math.round(r.right)} vw=${vw}`);
  }
  return { scroll: document.documentElement.scrollWidth > vw, bad: bad.slice(0, 5) };
});

for (const width of [320, 351, 360]) {
  test(`폭 ${width}px: 진입 화면이 화면 안에 들어온다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await page.addInitScript(() => { window.__SR_QUALITY__ = 'high'; });
    await page.goto('/');
    await expect(page.locator('#entry')).toBeVisible();
    expect(await overflowing(page)).toEqual({ scroll: false, bad: [] });
  });

  test(`폭 ${width}px: 해변 HUD와 편지 시트가 화면 안에 들어온다`, async ({ page }) => {
    await page.setViewportSize({ width, height: 740 });
    await gotoBeach(page);
    expect(await overflowing(page)).toEqual({ scroll: false, bad: [] });
    await page.click('#btn-bottle');
    expect(await overflowing(page)).toEqual({ scroll: false, bad: [] });
  });
}
