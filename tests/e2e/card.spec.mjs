// 이 파일이 하는 일: 바다의 병을 탭하면 편지 카드가 열리고, ♥는 한 번만, 답글이 달리고, 신고하면 내 바다에서 계속 사라지며, 남의 글은 글자로만 보이는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

// 바다 보기로 가서 병의 화면 좌표를 계산해 탭한다
async function tapBottle(page, id) {
  if ((await page.locator('#btn-sea').textContent()) === '바다로 가기') await page.click('#btn-sea');
  await page.waitForTimeout(1500);   // 카메라가 자리 잡을 때까지
  const p = await page.evaluate(id => window.__app.bottleField.screenPos(id, window.__app.camera), id);
  expect(p).not.toBe(null);
  await page.mouse.click(p.x, p.y);
}

const seed = extra => ({ fake: { bottles: [{ id: '00000000-0000-4000-8000-0000000000aa', message: '석양 같이 봐요', nickname: '친구', x: 0, z: -15, ...extra }] } });
const ID = '00000000-0000-4000-8000-0000000000aa';

test('병을 탭하면 카드가 열린다', async ({ page }) => {
  await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await tapBottle(page, ID);
  await expect(page.locator('#bottle-card')).toBeVisible();
  await expect(page.locator('#bottle-card .msg')).toHaveText('석양 같이 봐요');
  await expect(page.locator('#bottle-card .nick')).toHaveText('친구');
});

test('좋아요는 한 번', async ({ page }) => {
  const fake = await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await tapBottle(page, ID);
  await page.click('#card-like');
  await expect(page.locator('#card-like')).toHaveText('♥ 1');
  await expect(page.locator('#card-like')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#card-like');
  await expect(page.locator('#card-like')).toHaveText('♥ 1');
  expect(fake.state.bottles[0].likes).toBe(1);
});

test('답글을 달면 목록 맨 아래에 붙고, 50자 넘게는 못 쓴다', async ({ page }) => {
  const fake = await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await tapBottle(page, ID);
  await page.fill('#card-reply-input', '나도 보고 있어요');
  await page.click('#card-reply-send');
  await expect(page.locator('#bottle-card .reply').last()).toContainText('나도 보고 있어요');
  await expect(page.locator('#card-reply-input')).toHaveValue('');
  expect(fake.state.replies.length).toBe(1);
  expect(await page.getAttribute('#card-reply-input', 'maxlength')).toBe('50');
});

test('신고하면 사라지고, 새로고침·재실행 뒤에도 내 바다엔 없다', async ({ page }) => {
  const fake = await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await tapBottle(page, ID);
  await page.click('#card-report');
  await expect(page.locator('#card-report')).toHaveText('정말 신고할까요?');
  await page.click('#card-report');
  await expect(page.locator('#toast')).toHaveText('신고했어요. 내 바다에서 숨겼어요');
  await expect(page.locator('#bottle-card')).toHaveCount(0);
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(0);
  await page.evaluate(() => window.__app.refreshSea());
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(0);
  await page.reload();
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(0);
  expect(fake.state.bottles.length).toBe(1);   // 서버에는 남아 있다(신고 1번)
});

test('남의 글(닉네임·편지·답글)에 태그가 있어도 글자로만 보인다', async ({ page }) => {
  const evil = '<img src=x onerror="window.__pwned=1">';
  const fake = await gotoBeach(page, {}, seed({ nickname: '<b>x</b>', message: evil }));
  fake.addReply(ID, { nickname: '<i>y</i>', message: evil });
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await tapBottle(page, ID);
  await expect(page.locator('#bottle-card .msg')).toHaveText(evil);
  await expect(page.locator('#bottle-card .nick')).toHaveText('<b>x</b>');
  await expect(page.locator('#bottle-card .reply').first()).toContainText(evil);
  expect(await page.locator('#bottle-card img, #bottle-card b, #bottle-card i').count()).toBe(0);
  expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
});

test('드래그는 탭이 아니다', async ({ page }) => {
  await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await page.click('#btn-sea');
  await page.waitForTimeout(1500);
  const p = await page.evaluate(id => window.__app.bottleField.screenPos(id, window.__app.camera), ID);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 40, p.y, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator('#bottle-card')).toHaveCount(0);
});

test('좋아요가 서버에서 실패하면 숫자는 그대로, 안내', async ({ page }) => {
  const fake = await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await tapBottle(page, ID);
  await expect(page.locator('#bottle-card')).toBeVisible();   // 카드를 다 받은 뒤에 서버를 아프게 한다
  fake.setFail(500);
  await page.click('#card-like');
  await expect(page.locator('#toast')).toHaveText('잠시 후 다시 시도해 주세요');
  await expect(page.locator('#card-like')).toHaveText('♥ 0');
});

test('좁은 폰에서도 답글 입력칸이 보내기 버튼보다 넓다', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await page.evaluate(id => window.__app.openSharedBottle(id), ID);
  await expect(page.locator('#bottle-card')).toBeVisible();
  const input = await page.locator('#card-reply-input').boundingBox();
  const send = await page.locator('#card-reply-send').boundingBox();
  expect(input.width).toBeGreaterThan(send.width * 2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
});

test('카드를 연 사이 병이 숨겨지면 답글은 "더 답글을 달 수 없어요"(서버는 500+P0002)', async ({ page }) => {
  const fake = await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  await page.evaluate(id => window.__app.openSharedBottle(id), ID);
  await expect(page.locator('#bottle-card')).toBeVisible();
  fake.state.bottles[0].reports = 3;   // 그사이 다른 사람들이 신고해서 숨겨짐
  await page.fill('#card-reply-input', '늦은 답글');
  await page.click('#card-reply-send');
  await expect(page.locator('#card-error')).toHaveText('이 편지에는 더 답글을 달 수 없어요');
});

test('병을 누르고 응답이 오기 전에 다른 탭으로 가면 카드가 뜨지 않는다', async ({ page }) => {
  await gotoBeach(page, {}, seed());
  await page.waitForFunction(() => window.__app.bottleField.count === 1);
  // get_bottle만 1.5초 늦게 응답하게(나중에 등록한 route가 먼저 받고, fallback으로 가짜 서버에 넘긴다)
  await page.route('**/rest/v1/rpc/get_bottle', async route => { await new Promise(r => setTimeout(r, 1500)); await route.fallback(); });
  await page.evaluate(id => { window.__app.openBottleCard(id); }, ID);   // 결과를 기다리지 않는다(기다리면 응답 후에 탭을 누르게 됨)
  await page.click('button.tab[data-mode="messages"]');
  await page.waitForTimeout(2500);
  await expect(page.locator('#messages-panel')).toBeVisible();
  await expect(page.locator('#bottle-card')).toHaveCount(0);
  // 공유 링크도 같은 규칙: 응답 전에 석양멍으로 가면 카드도, 바다 보기 카메라 이동도 없다
  await page.click('button.tab[data-mode="move"]');
  await page.evaluate(id => { window.__app.openSharedBottle(id); }, ID);
  await page.click('button.tab[data-mode="zen"]');
  await page.waitForTimeout(2500);
  await expect(page.locator('#bottle-card')).toHaveCount(0);
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'zen');
});
