// 이 파일이 하는 일: D단계 실시간 — 친구의 표정·잔·튜브·수영장에 잠긴 모습이 내 화면에도 보이는지, 이상한 tube·drink는 무시하는지
import { test, expect } from '@playwright/test';
import { openTwo } from './two.mjs';

const friend = (page, expr) => page.waitForFunction(expr, null, { timeout: 5000 });

test('친구 표정·잔이 보인다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser, { profileA: { look: { hat: 'bucket', glasses: false, shirt: 2, cocktail: 1, face: 'wink' }, drink: { cocktail: 1, sips: 3 } } });
  await friend(b, () => window.__app.people.count() === 1);
  await friend(b, () => { const p = [...window.__app.people.people.values()][0]; return p.avatar.parts.faces.wink.visible && p.avatar.parts.cocktail.visible; });
  expect(await b.evaluate(() => [...window.__app.people.people.values()][0].avatar.parts.cocktail.getObjectByName('liquid').material.color.getHexString())).toBe('6cc4ee');
  await context.close();
});

test('친구가 사면 바로 보인다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await friend(b, () => window.__app.people.count() === 1);
  expect(await b.evaluate(() => [...window.__app.people.people.values()][0].avatar.parts.cocktail.visible)).toBe(false);
  await a.evaluate(() => window.__app.resort.buy(0));
  await friend(b, () => [...window.__app.people.people.values()][0].avatar.parts.cocktail.visible);
  await context.close();
});

test('친구 튜브는 앞바다에', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser, { profileA: { tube: 'donut' } });
  await friend(b, () => window.__app.people.count() === 1);
  await a.evaluate(() => { window.__app.player.teleport(0, -20, Math.PI); window.__app.realtime.sendMove({ x: 0, z: -20, ry: Math.PI }); });
  await friend(b, () => [...window.__app.people.people.values()][0].pos.z < -19);
  await friend(b, () => { const p = [...window.__app.people.people.values()][0]; return p.avatar.parts.tube.visible && p.anim.baseY < -0.4; });
  await context.close();
});

test('친구가 수영장에 있으면 잠겨 보인다', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await friend(b, () => window.__app.people.count() === 1);
  await a.evaluate(() => { window.__app.player.teleport(9, 14, 0); window.__app.realtime.sendMove({ x: 9, z: 14, ry: 0 }); });
  await friend(b, () => { const p = [...window.__app.people.people.values()][0]; return p.anim.baseY < -0.7 && p.anim.swim; });
  await context.close();
});

test('이상한 tube·drink는 무시', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await friend(b, () => window.__app.people.count() === 1);
  const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  await a.evaluate(sid => window.__rtFake.rawTrack({ sid, nick: '이상해', look: { face: 'evil' }, x: 1, z: 1, ry: 0, mode: 'move', tube: 'boat', drink: 9 }), SID);
  await friend(b, () => window.__app.people.count() === 2);
  const p = await b.evaluate(sid => { const p = window.__app.people.people.get(sid); return { tube: p.avatar.parts.tube.visible, cup: p.avatar.parts.cocktail.visible, smile: p.avatar.parts.faces.smile.visible }; }, SID);
  expect(p).toEqual({ tube: false, cup: false, smile: true });
  expect(b.errors).toEqual([]);
  await context.close();
});
