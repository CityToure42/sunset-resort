// 이 파일이 하는 일: 조개 지갑 규칙 — 조개 얻기(상한 9999), 바에서 칵테일 사기(🐚3, 모자라면 거절), 한 잔에 세 모금 마시기. 화면이 없는 순수 규칙이라 테스트가 쉽다
export const START_SHELLS = 3;
export const MAX_SHELLS = 9999;
export const PRICE = 3;
export const SIPS = 3;
export const ZEN_SHELL_SECONDS = 60;
// 순서는 avatar.js의 COCKTAIL_COLORS(주황·파랑·분홍·초록)와 같다
export const MENU = [
  { id: 0, name: '선셋 오렌지' },
  { id: 1, name: '블루 라군' },
  { id: 2, name: '핑크 플라밍고' },
  { id: 3, name: '모히또' }
];

export function earn(profile, n = 1) {
  profile.shells = Math.min(MAX_SHELLS, (profile.shells | 0) + n);
  return profile.shells;
}

export function buy(profile, id) {
  if (!Number.isInteger(id) || !MENU.some(m => m.id === id)) return { ok: false, reason: 'menu' };
  if ((profile.shells | 0) < PRICE) return { ok: false, reason: 'shells' };   // 모자라면 한 개도 빼지 않는다
  profile.shells -= PRICE;
  profile.drink = { cocktail: id, sips: SIPS };   // 들고 있던 잔은 새 잔으로 바뀐다
  return { ok: true };
}

// 한 모금: 남은 모금 수를 돌려준다. 0이 되면 빈손. 잔이 없으면 null
export function sip(profile) {
  if (!profile.drink) return null;
  const left = profile.drink.sips - 1;
  if (left <= 0) { profile.drink = null; return 0; }
  profile.drink.sips = left;
  return left;
}
