// 이 파일이 하는 일: 최종 코드 검토에서 나온 버그들이 다시 생기지 않는지 확인 (각 테스트 이름 앞 기호는 검토 항목 번호)
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';
import { installFakeSupabase } from './fake-supabase.mjs';

// 진짜 서버로 나가지 않게 가짜 Supabase를 먼저 끼운다(gotoBeach를 쓰는 테스트는 거기서 다시 끼운 것이 우선)
test.beforeEach(async ({ page }) => { await installFakeSupabase(page); });

const touch = (page, type, x, y, id = 7) => page.evaluate(([type, x, y, id]) => {
  const target = document.elementFromPoint(x, y) || document.getElementById('joystick-layer');
  target.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
}, [type, x, y, id]);

test('C1: localStorage 접근 자체가 막혀도 진입 화면이 뜨고 쓸 수 있다', async ({ page }) => {
  await page.addInitScript(() => {
    window.__SR_QUALITY__ = 'high';
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.locator('#entry')).toBeVisible();
  await page.fill('#nick', '세민');
  await page.click('#enter');
  await expect(page.locator('body')).toHaveAttribute('data-mode', 'move');
  await expect(page.locator('#toast')).toHaveText('이번엔 저장이 안 돼요');
});

test('I5: 저장값이 이상해도(look:null, bottles:[null]) 하얗게 죽지 않고 해변이 뜬다', async ({ page }) => {
  await page.addInitScript(() => {
    window.__SR_QUALITY__ = 'high';
    localStorage.setItem('sunset-resort:v1', JSON.stringify({ token: 't', nickname: '세민', look: null, bottles: [null, { id: 'x' }] }));
  });
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.mode === 'move', null, { timeout: 8000 });
  expect(await page.evaluate(() => window.__app.bottleField.count)).toBe(0);
});

test('I1: 오른쪽 절반 터치 드래그는 카메라만 돌리고 캐릭터는 걷지 않는다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({ x: window.__app.player.position.x, z: window.__app.player.position.z, yaw: window.__app.cameraRig.yaw }));
  await touch(page, 'pointerdown', 300, 600);
  for (let i = 1; i <= 6; i++) { await touch(page, 'pointermove', 300 - i * 15, 600); await page.waitForTimeout(60); }
  await page.waitForTimeout(400);
  await touch(page, 'pointerup', 210, 600);
  const after = await page.evaluate(() => ({ x: window.__app.player.position.x, z: window.__app.player.position.z, yaw: window.__app.cameraRig.yaw }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(0.05);
  expect(after.yaw).not.toBe(before.yaw);
});

test('I1: 왼쪽 절반 터치 드래그는 걷고 카메라는 돌리지 않는다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(300);
  const yaw0 = await page.evaluate(() => window.__app.cameraRig.yaw);
  await touch(page, 'pointerdown', 100, 600);
  await touch(page, 'pointermove', 100, 530);
  await page.waitForFunction(() => window.__app.anim.state === 'walk', null, { timeout: 5000 });
  await touch(page, 'pointerup', 100, 530);
  expect(await page.evaluate(() => window.__app.cameraRig.yaw)).toBe(yaw0);
});

test('I2: 편지·닉네임 칸에서 W·A·S·D를 칠 수 있고 캐릭터는 움직이지 않는다', async ({ page }) => {
  await gotoBeach(page);
  const p0 = await page.evaluate(() => [window.__app.player.position.x, window.__app.player.position.z]);
  await page.click('#btn-bottle');
  await page.click('#bottle-msg');
  await page.keyboard.type('was dw');
  await expect(page.locator('#bottle-msg')).toHaveValue('was dw');
  await page.waitForTimeout(300);
  const p1 = await page.evaluate(() => [window.__app.player.position.x, window.__app.player.position.z]);
  expect(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])).toBeLessThan(0.01);
});

test('I3: 바다 보기 중에 석양멍을 눌러도 석양멍 카메라가 된다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-sea');
  await page.click('button.tab[data-mode="zen"]');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('zen');
  await page.click('#zen-end');
  await expect(page.locator('#btn-sea')).toHaveText('바다로 가기');
  expect(await page.evaluate(() => window.__app.cameraRig.mode)).toBe('follow');
});

test('I4: 편지 쓰기·꾸미기 시트를 연 채 석양멍으로 가면 시트가 닫힌다', async ({ page }) => {
  await gotoBeach(page);
  await page.click('#btn-bottle');
  await expect(page.locator('#bottle-panel')).toBeVisible();
  await page.click('button.tab[data-mode="zen"]');
  await expect(page.locator('#bottle-panel')).toHaveCount(0);
  await page.click('#zen-end');
  await page.click('#btn-customize');
  await expect(page.locator('#customize-panel')).toBeVisible();
  await page.click('button.tab[data-mode="zen"]');
  await expect(page.locator('#customize-panel')).toHaveCount(0);
});

test('M1: 화면 위쪽 빈 띠도 조이스틱·카메라 터치를 받는다', async ({ page }) => {
  await gotoBeach(page);
  const id = await page.evaluate(() => document.elementFromPoint(250, 108)?.id);
  expect(id).toBe('joystick-layer');
});

test('M2: 조이스틱을 잡은 채 앱이 가려지면(pagehide) 입력이 0이 된다', async ({ page }) => {
  await gotoBeach(page);
  await touch(page, 'pointerdown', 100, 600);
  await touch(page, 'pointermove', 100, 530);
  expect(await page.evaluate(() => window.__app.joystick.active)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => window.__app.joystick.vector)).toEqual({ x: 0, y: 0 });
  expect(await page.evaluate(() => window.__app.joystick.active)).toBe(false);
});

test('M7: 버튼은 두 번 탭해도 화면이 확대되지 않게 touch-action: manipulation', async ({ page }) => {
  await gotoBeach(page);
  const ta = await page.evaluate(() => getComputedStyle(document.querySelector('button.tab')).touchAction);
  expect(ta).toBe('manipulation');
});
