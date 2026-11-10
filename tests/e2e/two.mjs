// 이 파일이 하는 일: 실시간 테스트용 — 같은 브라우저 컨텍스트에 페이지 두 개(A '하나', B '둘')를 열어 가짜 실시간 연결로 서로 잇는다
import { installFakeSupabase } from './fake-supabase.mjs';
import { STORAGE_KEY, TEST_NOW } from './helpers.mjs';

export const TOKEN_A = 'aaaaaaaa-1111-4111-8111-111111111111';
export const TOKEN_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const profile = (nickname, token, shirt) => ({
  token, nickname, look: { hat: 'bucket', glasses: false, shirt, cocktail: 1 },
  zenSeconds: 0, cocktails: { date: '', count: 0 }, bottles: []
});
export const PROFILE_A = profile('하나', TOKEN_A, 2);
export const PROFILE_B = profile('두리', TOKEN_B, 4);

async function openOne(context, p, extraInit) {
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(String(e)));
  await page.addInitScript(([key, value]) => { localStorage.setItem(key, JSON.stringify(value)); }, [STORAGE_KEY, p]);
  if (extraInit) await page.addInitScript(extraInit);
  await installFakeSupabase(page);
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
  return page;
}

// 컨텍스트의 기본 설정(baseURL·화면 크기·WebGL 플래그)은 playwright.config의 use를 따른다
export async function openTwo(browser, { baseURL = 'http://127.0.0.1:4173', extraInitA } = {}) {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(t => { window.__SR_RT__ = 'fake'; window.__SR_NOW__ = t; window.__SR_QUALITY__ = 'high'; }, TEST_NOW);
  const a = await openOne(context, PROFILE_A, extraInitA);
  const b = await openOne(context, PROFILE_B);
  return { context, a, b };
}

// 그 페이지가 본 다른 사람들(테스트용 요약)
export const others = page => page.evaluate(() => [...window.__app.people.people.values()].map(p => ({
  sid: p.sid, nick: p.nick, look: p.look, mode: p.mode, x: p.pos.x, z: p.pos.z, anim: p.anim.state, visible: p.avatar.group.visible
})));

// 페이지를 숨김/보임 상태로 흉내 낸다(앱을 내렸다 올리기)
export const setHidden = (page, hidden) => page.evaluate(h => {
  Object.defineProperty(document, 'visibilityState', { value: h ? 'hidden' : 'visible', configurable: true });
  Object.defineProperty(document, 'hidden', { value: h, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
