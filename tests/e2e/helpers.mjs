// 이 파일이 하는 일: e2e 테스트 공용 도우미 — 저장된 프로필을 미리 넣어 진입 화면을 건너뛰고 바로 해변으로 들어가게 한다
export const STORAGE_KEY = 'sunset-resort:v1';

// 테스트 시계: KST 2026-11-05 15:00 (파스텔 무드, 석양 이벤트 아님)
export const TEST_NOW = Date.UTC(2026, 10, 5, 6, 0);

export async function seedProfile(page, extra = {}) {
  // 테스트 컴퓨터는 소프트웨어로 그려서 느리므로, 자동 품질 조정을 꺼 둔다(그 안내 토스트가 다른 테스트를 방해하지 않게)
  await page.addInitScript(t => { window.__SR_NOW__ = t; window.__SR_QUALITY__ = 'high'; }, TEST_NOW);
  const profile = {
    token: '11111111-2222-4333-8444-555555555555',
    nickname: '테스트',
    look: { hat: 'straw', glasses: true, shirt: 0, cocktail: 0 },
    zenSeconds: 0,
    cocktails: { date: '', count: 0 },
    bottles: [],
    ...extra
  };
  // 새로고침 때 저장값을 덮어쓰지 않도록, 아직 아무것도 없을 때만 넣는다
  await page.addInitScript(([key, value]) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(value)); }, [STORAGE_KEY, profile]);
}

export async function gotoBeach(page, extra = {}) {
  await seedProfile(page, extra);
  await page.goto('/');
  await page.waitForFunction(() => document.body.dataset.mode === 'move');
}
