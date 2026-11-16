// 이 파일이 하는 일: 선베드 6세트 — 석양멍은 가장 가까운 빈 선베드, 친구가 누운 자리는 피한다
import { test, expect } from '@playwright/test';
import { gotoBeach } from './helpers.mjs';
import { openTwo } from './two.mjs';

const seat = page => page.evaluate(() => { const s = window.__app.zenSeat; return s && [s.x, s.z]; });

test('선베드 6개', async ({ page }) => {
  await gotoBeach(page);
  expect(await page.evaluate(() => window.__app.world.props.points.sunbeds.length)).toBe(6);
});

test('가까운 빈 선베드에 눕는다', async ({ page }) => {
  await gotoBeach(page);
  await page.evaluate(() => window.__app.player.teleport(1.8, 4, 0));
  await page.click('button.tab[data-mode="zen"]');
  expect(await seat(page)).toEqual([1.8, 2.0]);
});

test('친구가 누운 자리는 피한다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.evaluate(() => window.__app.player.teleport(1.8, 4, 0));
  await a.click('button.tab[data-mode="zen"]');
  expect(await seat(a)).toEqual([1.8, 2.0]);
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].mode === 'zen', null, { timeout: 4000 });
  await b.waitForTimeout(800);   // A가 선베드로 옮긴 위치가 도착할 때까지
  await b.evaluate(() => window.__app.player.teleport(1.8, 4, 0));
  await b.click('button.tab[data-mode="zen"]');
  expect(await seat(b)).toEqual([3.5, 6.5]);
  await context.close();
});

test('친구가 막 석양멍을 눌렀을 때(내 화면에서 아직 미끄러져 가는 중)도 그 자리는 피한다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.evaluate(() => window.__app.player.teleport(1.8, 3.8, 0));
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].pos.z > 3.6, null, { timeout: 4000 });
  await a.click('button.tab[data-mode="zen"]');
  expect(await seat(a)).toEqual([1.8, 2.0]);
  // A가 석양멍이 됐다는 소식이 오자마자(보간이 끝나기 전) B도 같은 곳에서 석양멍
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].mode === 'zen', null, { timeout: 4000 });
  await b.evaluate(() => { window.__app.player.teleport(1.8, 4, 0); document.querySelector('button.tab[data-mode="zen"]').click(); });
  expect(await seat(b)).toEqual([3.5, 6.5]);
  await context.close();
});
