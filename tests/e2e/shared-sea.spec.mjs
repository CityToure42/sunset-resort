// 이 파일이 하는 일: 모두의 바다 — 남의 병이 내 바다에 뜨고, 띄운 병은 서버에 저장되며, 연타해도 하나만, 서버가 아파도 앱은 버티고, 폰에 있던 병은 서버로 옮겨지는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

const ME = '11111111-2222-4333-8444-555555555555';

async function writeAndPick(page, message = '모두의 바다') {
  await page.click('#btn-bottle');
  await page.fill('#bottle-msg', message);
  await page.click('#bottle-next');
  await expect(page.locator('#bottle-pick')).toBeVisible();
}

test('남의 병이 내 바다에 뜬다', async ({ page }) => {
  await gotoBeach(page, {}, { fake: { bottles: [{ message: '하나', x: -3 }, { message: '둘', x: 3 }] } });
  await page.waitForFunction(() => window.__app.bottleField.count === 2, null, { timeout: 5000 });
});

test('내 병에는 별 표시', async ({ page }) => {
  await gotoBeach(page, {}, { fake: { bottles: [{ owner_token: ME, message: '내 것' }, { message: '남의 것', x: 5 }] } });
  await page.waitForFunction(() => window.__app.bottleField.count === 2, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__app.bottleField.starCount)).toBe(1);
});

test('띄우면 서버에 저장되고 링크에 서버 id가 들어간다', async ({ page }) => {
  const fake = await gotoBeach(page);
  await writeAndPick(page);
  await page.click('#bottle-place');
  await expect(page.locator('#toast')).toHaveText('편지가 바다에 띄워졌어요');
  expect(fake.state.bottles.length).toBe(1);
  expect(fake.state.bottles[0].owner_token).toBe(ME);
  await expect(page.locator('#bottle-link')).toHaveValue(new RegExp('#b=' + fake.state.bottles[0].id + '$'));
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(1);
});

test('중복 띄우기 방지: 연타해도 병은 하나', async ({ page }) => {
  const fake = await gotoBeach(page);
  await writeAndPick(page);
  await page.dblclick('#bottle-place');
  await expect(page.locator('#toast')).toHaveText('편지가 바다에 띄워졌어요');
  await page.waitForTimeout(500);
  expect(fake.state.bottles.length).toBe(1);
});

test('띄우기 실패 → 이유 안내·"다시 띄우기"·연타해도 하나 → 복구 후 성공', async ({ page }) => {
  const fake = await gotoBeach(page);
  await writeAndPick(page);
  fake.setFail(500);
  await page.click('#bottle-place');
  await expect(page.locator('#pick-error')).toHaveText('잠시 후 다시 시도해 주세요');
  await expect(page.locator('#bottle-place')).toHaveText('다시 띄우기');
  expect(fake.state.bottles.length).toBe(0);
  fake.setFail(null);
  await page.dblclick('#bottle-place');
  await expect(page.locator('#toast')).toHaveText('편지가 바다에 띄워졌어요');
  await page.waitForTimeout(500);
  expect(fake.state.bottles.length).toBe(1);
});

test('서버 오류에도 해변은 정상', async ({ page }) => {
  await gotoBeach(page, {}, { fake: { failWith: 500 } });
  await expect(page.locator('#toast')).toHaveText('바다 소식을 불러오지 못했어요');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
  const z0 = await page.evaluate(() => window.__app.player.position.z);
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(z0 => z0 - window.__app.player.position.z > 0.5, z0, { timeout: 10000 });
  await page.keyboard.up('ArrowUp');
});

test('새로고침: refreshSea·화면 복귀 때 새 병을 받고, 주기는 60초', async ({ page }) => {
  const fake = await gotoBeach(page);
  await page.waitForTimeout(300);
  fake.addBottle({ message: '새 편지' });
  await page.evaluate(() => window.__app.refreshSea());
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(1);
  fake.addBottle({ message: '또 새 편지', x: 4 });
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => window.__app.bottleField.count === 2, null, { timeout: 5000 });
  expect(await page.evaluate(() => window.__app.seaRefreshMs)).toBe(60000);
});

test('A단계 폰 병 옮기기: 진입하면 서버로 올라가고 폰 목록은 빈다', async ({ page }) => {
  const local = [
    { id: 'l1', shape: 'round', message: '옛 편지 1', x: -2, z: -15, nickname: '테스트', createdAt: '2026-11-04T00:00:00Z', likes: 0 },
    { id: 'l2', shape: 'star', message: '옛 편지 2', x: 2, z: -16, nickname: '테스트', createdAt: '2026-11-04T00:00:01Z', likes: 0 }
  ];
  const fake = await gotoBeach(page, { bottles: local });
  await page.waitForFunction(() => window.__app.profile.bottles.length === 0, null, { timeout: 5000 });
  expect(fake.state.bottles.map(b => b.message).sort()).toEqual(['옛 편지 1', '옛 편지 2']);
  await page.waitForFunction(() => window.__app.bottleField.count === 2, null, { timeout: 5000 });
});
