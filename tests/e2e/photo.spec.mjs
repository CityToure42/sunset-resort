// 이 파일이 하는 일: 사진찍기 탭이 지금 3D 화면을 이미지로 만들고, 왼쪽 아래에 앱 이름·닉네임 워터마크를 넣고, 원래 모드로 돌아오는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('사진찍기: 이미지가 만들어지고 워터마크가 있고 이동하기로 돌아온다', async ({ page }) => {
  await gotoBeach(page, { nickname: '세민' });
  await page.waitForTimeout(600);
  await page.click('button.tab[data-mode="photo"]');
  await page.waitForFunction(() => (window.__app.lastPhotoSize ?? 0) > 20000, null, { timeout: 5000 });
  await expect(page.locator('#toast')).toHaveText('사진을 찍었어요');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');

  const info = await page.evaluate(() => {
    const c = window.__app.lastPhotoCanvas;
    const g = c.getContext('2d');
    // 왼쪽 아래 워터마크 영역에서 거의 흰 픽셀 개수 세기
    const h = c.height, w = c.width;
    const box = g.getImageData(0, Math.floor(h * 0.9), Math.floor(w * 0.6), Math.floor(h * 0.1)).data;
    let white = 0;
    for (let i = 0; i < box.length; i += 4) if (box[i] > 230 && box[i + 1] > 230 && box[i + 2] > 230) white++;
    // 가운데(3D 장면)는 워터마크가 없어 검정 일색이 아니어야 한다
    const mid = g.getImageData(Math.floor(w / 2), Math.floor(h / 2), 1, 1).data;
    return { white, w, h, mid: [mid[0], mid[1], mid[2]], text: window.__app.lastPhotoLabel };
  });
  expect(info.white).toBeGreaterThan(40);
  expect(info.mid[0] + info.mid[1] + info.mid[2]).toBeGreaterThan(30);
  expect(info.text).toBe('Sunset Resort · 세민');
});

test('놀기 중에 사진을 찍으면 놀기로 돌아온다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('button.tab[data-mode="play"]');
  await page.click('button.tab[data-mode="photo"]');
  await page.waitForFunction(() => (window.__app.lastPhotoSize ?? 0) > 20000, null, { timeout: 5000 });
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'play');
});
