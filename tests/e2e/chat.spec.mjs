// 이 파일이 하는 일: 채팅 말풍선 — 말하면 양쪽 머리 위에 뜨고 5초 뒤 사라지며, 태그는 글자로만, 2초에 한 번, 끊겼으면 '보내지 못했어요'
import { test, expect } from '@playwright/test';
import { openTwo } from './two.mjs';

async function say(page, text) {
  if (!(await page.locator('#chat-input').isVisible())) await page.click('#chat-btn');
  await page.fill('#chat-input', text);
  await page.click('#chat-send');
}
const bubbleOfA = (b, a) => a.evaluate(() => window.__app.sid).then(sid => b.evaluate(s => window.__app.people.bubbleOf(s), sid));

test('말하면 양쪽 머리 위에', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await say(a, '안녕');
  await expect(a.locator('#chat-input')).toHaveValue('');
  expect(await a.evaluate(() => window.__app.people.bubbleOf('me'))).toBe('안녕');
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].bubble?.userData.text === '안녕', null, { timeout: 3000 });
  expect(await bubbleOfA(b, a)).toBe('안녕');
  await context.close();
});

test('5초 뒤 사라짐', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await say(a, '잠깐만 보여');
  await b.waitForFunction(() => [...window.__app.people.people.values()][0].bubble, null, { timeout: 3000 });
  await a.waitForTimeout(5500);
  expect(await a.evaluate(() => window.__app.people.bubbleOf('me'))).toBe(null);
  expect(await bubbleOfA(b, a)).toBe(null);
  await context.close();
});

test('태그가 든 채팅·닉네임은 글자로만', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  const imgs = await b.evaluate(() => document.querySelectorAll('img').length);
  const evil = '<img src=x onerror="window.__pwned=1">';
  // 앱을 고친 누군가가 이상한 닉네임으로 들어와 태그를 말하는 상황
  const SID = '0f8fad5b-d9cb-469f-a165-70867728950e';
  await a.evaluate(([sid, evil]) => {
    window.__rtFake.rawTrack({ sid, nick: '<b>x</b>', look: {}, x: 1, z: 1, ry: 0, mode: 'move' });
    setTimeout(() => window.__rtFake.raw('chat', { sid, text: evil }), 200);
  }, [SID, evil]);
  await b.waitForFunction(sid => window.__app.people.bubbleOf(sid), SID, { timeout: 3000 });
  expect(await b.evaluate(sid => window.__app.people.bubbleOf(sid), SID)).toBe(evil.slice(0, 30));
  expect(await b.evaluate(sid => window.__app.people.people.get(sid).nick, SID)).toBe('손님');
  expect(await b.evaluate(() => window.__pwned)).toBeUndefined();
  expect(await b.evaluate(() => document.querySelectorAll('img').length)).toBe(imgs);
  await context.close();
});

test('2초에 한 번', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await say(a, '첫번째');
  await say(a, '두번째');
  await expect(a.locator('#chat-input')).toHaveValue('두번째');
  await a.waitForTimeout(800);
  expect(await a.evaluate(() => window.__rtSent.filter(m => m.event === 'chat').length)).toBe(1);
  await context.close();
});

test('끊겼으면 보내지 못했어요', async ({ browser }) => {
  const { context, a, b } = await openTwo(browser);
  await b.waitForFunction(() => window.__app.people.count() === 1);
  await a.evaluate(() => { window.__rtFake.failNext(100); window.__rtFake.drop(); });
  await say(a, '들리나요');
  await expect(a.locator('#chat-error')).toHaveText('보내지 못했어요');
  await expect(a.locator('#chat-input')).toHaveValue('들리나요');
  await context.close();
});

test('30자 제한·placeholder', async ({ browser }) => {
  const { context, a } = await openTwo(browser);
  await a.click('#chat-btn');
  expect(await a.getAttribute('#chat-input', 'maxlength')).toBe('30');
  expect(await a.getAttribute('#chat-input', 'placeholder')).toBe('30자까지 말하기');
  await expect(a.locator('#chat-send')).toHaveText('보내기');
  await context.close();
});

test('석양멍 중엔 💬 버튼이 안 보인다', async ({ browser }) => {
  const { context, a } = await openTwo(browser);
  await expect(a.locator('#chat-btn')).toBeVisible();
  await a.click('button.tab[data-mode="zen"]');
  await expect(a.locator('#chat-btn')).toBeHidden();
  await context.close();
});
