// 이 파일이 하는 일: 같은 해변 — 두 페이지가 서로의 캐릭터·걷기·건배·닉네임·꾸미기를 보고, 숨겼다 돌아와도 하나만, 이상한 메시지·기기 열쇠·30초 정리를 확인
import { test, expect } from '@playwright/test';
import { openTwo, others, setHidden, PROFILE_A, TOKEN_A } from './two.mjs';

test('서로 보인다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await a.waitForFunction(() => window.__app.people.count() === 1);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await expect(a.locator('#chip-people')).toHaveText('지금 2명이 함께 있어요');
  await expect(b.locator('#chip-people')).toHaveText('지금 2명이 함께 있어요');
  await context.close();
});

test('A가 걸으면 B 화면의 A가 따라온다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.bringToFront();
  await a.keyboard.down('ArrowUp');
  await a.waitForTimeout(1500);
  await a.keyboard.up('ArrowUp');
  // 테스트 컴퓨터는 창 두 개를 소프트웨어로 그려 느리므로 '얼마나' 걸었는지 대신, 걸은 만큼 B에서도 따라왔는지 본다
  const az = await a.evaluate(() => window.__app.player.position.z);
  expect(az).toBeLessThan(-0.3);
  await b.bringToFront();
  await b.waitForFunction(az => Math.abs([...window.__app.people.people.values()][0].pos.z - az) < 0.1, az, { timeout: 4000 });
  await context.close();
});

test('건배가 보인다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.click('button.tab[data-mode="play"]');
  await a.click('.emote[data-emote="cheers"]');
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].anim.state === 'cheers', null, { timeout: 3000 });
  await context.close();
});

test('닉네임표·꾸미기', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  const [pa] = await others(b);
  expect(pa.nick).toBe('하나');
  expect(pa.look).toEqual(PROFILE_A.look);
  expect(await b.evaluate(() => [...window.__app.people.people.values()][0].label?.userData?.text)).toBe('하나');
  // A가 꾸미기를 바꾸면 B에도 반영
  await a.evaluate(() => window.__app.onCustomize());
  await a.click('#customize-panel .look button:has-text("밀짚모자")');
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].look.hat === 'straw', null, { timeout: 3000 });
  await context.close();
});

test('숨겼다 돌아와도 캐릭터는 하나', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await setHidden(a, true);
  await b.waitForFunction(() => window.__app.people.count() === 0, null, { timeout: 3000 });
  await setHidden(a, false);
  await b.waitForFunction(() => window.__app.people.count() === 1, null, { timeout: 3000 });
  await b.waitForTimeout(500);
  expect(await b.evaluate(() => window.__app.people.count())).toBe(1);
  await a.waitForFunction(() => window.__app.people.count() === 1, null, { timeout: 3000 });
  await context.close();
});

test('이상한 메시지는 무시', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.evaluate(() => {
    const sid = window.__app.sid;
    window.__rtFake.raw('move', { sid, x: NaN, z: 0, ry: 0 });
    window.__rtFake.raw('move', { sid, x: 999, z: 0, ry: 0 });
    window.__rtFake.raw('emote', { sid, name: 'explode' });
    window.__rtFake.raw('move', { sid, x: 'a', z: {}, ry: [] });
  });
  await b.waitForTimeout(1500);
  const [pa] = await others(b);
  expect(Number.isFinite(pa.x) && Number.isFinite(pa.z)).toBe(true);
  expect(Math.abs(pa.x)).toBeLessThanOrEqual(30);
  expect(pa.anim).not.toBe('explode');
  expect(b.errors).toEqual([]);
  await context.close();
});

test('기기 열쇠는 실시간으로 나가지 않는다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.keyboard.down('ArrowLeft'); await a.waitForTimeout(600); await a.keyboard.up('ArrowLeft');
  await a.click('button.tab[data-mode="play"]');
  await a.click('.emote[data-emote="wave"]');
  await a.click('button.tab[data-mode="zen"]');
  await a.waitForTimeout(500);
  const sent = await a.evaluate(() => JSON.stringify(window.__rtSent));
  expect(sent.length).toBeGreaterThan(50);
  expect(sent.includes(TOKEN_A)).toBe(false);
  expect(sent.includes('aaaaaaaa-1111')).toBe(false);
  await context.close();
});

test('석양멍 중인 사람은 누운 자세로 보인다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.click('button.tab[data-mode="zen"]');
  await b.waitForFunction(() => { const p = [...window.__app.people.people.values()][0]; return p.mode === 'zen' && p.anim.state === 'lie'; }, null, { timeout: 3000 });
  await context.close();
});

test('소식이 끊기면 30초 뒤 사라진다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.evaluate(() => window.__rtFake.silence());
  await b.evaluate(() => window.__app.people.prune(Date.now() + 29000));
  expect(await b.evaluate(() => window.__app.people.count())).toBe(1);
  await b.evaluate(() => window.__app.people.prune(Date.now() + 30001));
  expect(await b.evaluate(() => window.__app.people.count())).toBe(0);
  await context.close();
});

test('실시간이 꺼져 있으면(off) 인원 칩·배지 없음', async ({ page }) => {
  const { gotoBeach } = await import('./helpers.mjs');
  await gotoBeach(page);
  await expect(page.locator('#chip-people')).toBeHidden();
  await expect(page.locator('#chip-link')).toBeHidden();
  expect(await page.evaluate(() => window.__app.realtime?.status ?? 'none')).toBe('idle');
});
