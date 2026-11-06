// 이 파일이 하는 일: 브라우저에서 키보드·조이스틱으로 캐릭터가 실제로 움직이고, 포인터 취소·화면 회전에도 입력이 망가지지 않는지 확인
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';

test('ArrowUp을 누르고 있으면 캐릭터가 앞으로 간다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(500);
  const z0 = await page.evaluate(() => window.__app.player.position.z);
  await page.keyboard.down('ArrowUp');
  // 테스트 컴퓨터의 그리기 속도와 상관없이: 1칸 이상 앞으로(-z) 갈 때까지 기다린다
  await page.waitForFunction(z0 => z0 - window.__app.player.position.z >= 1.0, z0, { timeout: 10000 });
  await page.keyboard.up('ArrowUp');
  // 손을 떼면 멈춘다
  const z1 = await page.evaluate(() => window.__app.player.position.z);
  await page.waitForTimeout(400);
  const z2 = await page.evaluate(() => window.__app.player.position.z);
  expect(Math.abs(z2 - z1)).toBeLessThan(0.2);
});

test('조이스틱: 터치 다운-무브-캔슬 후 vector는 0', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(500);
  const v = await page.evaluate(() => {
    const layer = document.getElementById('joystick-layer');
    const ev = (type, x, y) => layer.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', 150, 600);
    ev('pointermove', 150, 540);
    const during = { ...window.__app.joystick.vector };
    ev('pointercancel', 150, 540);
    return { during, after: { ...window.__app.joystick.vector }, active: window.__app.joystick.active };
  });
  expect(v.during.y).toBeLessThan(-0.5);
  expect(v.after).toEqual({ x: 0, y: 0 });
  expect(v.active).toBe(false);
});

test('가로로 회전한 뒤에도 조이스틱을 다시 만들 수 있다', async ({ page }) => {
  await gotoBeach(page);
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  const ok = await page.evaluate(() => {
    const layer = document.getElementById('joystick-layer');
    const ev = (type, x, y) => layer.dispatchEvent(new PointerEvent(type, { pointerId: 2, clientX: x, clientY: y, bubbles: true, pointerType: 'touch', isPrimary: true }));
    ev('pointerdown', 200, 300);
    ev('pointermove', 260, 300);
    const stick = document.querySelector('#joystick-layer .stick');
    const r = { exists: !!stick, x: window.__app.joystick.vector.x };
    ev('pointerup', 260, 300);
    return r;
  });
  expect(ok.exists).toBe(true);
  expect(ok.x).toBeGreaterThan(0.9);
});
