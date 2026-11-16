// 이 파일이 하는 일: "내 정보"의 기본 모양(토큰·닉네임·꾸미기(표정 포함)·석양멍 시간·내 병 목록·조개·들고 있는 잔·튜브)을 정의하고, 저장된 값이 허용 범위인지 정리한다
import { validateBottle } from './bottles.js';
import { START_SHELLS, MAX_SHELLS, SIPS } from './wallet.js';

export const HATS = ['straw', 'bucket', 'none'];
export const SHIRT_COUNT = 6;
export const COCKTAIL_COUNT = 4;
export const FACES = ['smile', 'round', 'grin', 'wink', 'heart', 'sleepy'];   // 기본 미소·땡그란 눈·활짝 웃음·윙크·하트 눈·졸린 눈
export const TUBES = ['donut', 'flamingo', 'watermelon'];
export const DEFAULT_LOOK = Object.freeze({ hat: 'straw', glasses: true, shirt: 0, cocktail: 0, face: 'smile' });

function randomUUID() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  // 아주 오래된 브라우저용 대체: 형식만 같은 무작위 값
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function normalizeLook(look = {}) {
  if (!look || typeof look !== 'object') look = {};
  const hat = HATS.includes(look.hat) ? look.hat : DEFAULT_LOOK.hat;
  const glasses = typeof look.glasses === 'boolean' ? look.glasses : DEFAULT_LOOK.glasses;
  const shirt = Number.isInteger(look.shirt) && look.shirt >= 0 && look.shirt < SHIRT_COUNT ? look.shirt : DEFAULT_LOOK.shirt;
  const cocktail = Number.isInteger(look.cocktail) && look.cocktail >= 0 && look.cocktail < COCKTAIL_COUNT ? look.cocktail : DEFAULT_LOOK.cocktail;
  const face = FACES.includes(look.face) ? look.face : DEFAULT_LOOK.face;
  return { hat, glasses, shirt, cocktail, face };
}

export function defaultProfile() {
  return {
    token: randomUUID(),
    nickname: '',
    look: { ...DEFAULT_LOOK },
    zenSeconds: 0,
    cocktails: { date: '', count: 0 },
    bottles: [],
    reportedIds: [],      // 내가 신고한 병(내 바다에서 숨김)
    lastSeenReplyAt: '',  // 메시지 보기를 마지막으로 연 시점의 최신 답글 시각(빨간 점 판단)
    shells: START_SHELLS, // D단계: 조개(칵테일 사는 데 씀)
    drink: null,          // 들고 있는 잔 { cocktail: 0~3, sips: 1~3 }
    tube: null            // 빌린 튜브 종류
  };
}

function cleanDrink(d) {
  const ok = d && typeof d === 'object' && Number.isInteger(d.cocktail) && d.cocktail >= 0 && d.cocktail < COCKTAIL_COUNT
    && Number.isInteger(d.sips) && d.sips >= 1 && d.sips <= SIPS;
  return ok ? { cocktail: d.cocktail, sips: d.sips } : null;
}

// 저장된 병 중 모양·내용·위치가 올바르고 id가 있는 것만 남긴다
function cleanBottles(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(b => b && typeof b === 'object' && typeof b.id === 'string' && b.id && validateBottle(b).ok);
}

// 저장된 내용(빠지거나 깨진 값이 있을 수 있음)을 안전한 프로필로 합친다
export function hydrateProfile(saved = {}) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const base = defaultProfile();
  return {
    token: typeof saved.token === 'string' && saved.token ? saved.token : base.token,
    nickname: typeof saved.nickname === 'string' ? saved.nickname : '',
    look: normalizeLook(saved.look),
    zenSeconds: Number.isFinite(saved.zenSeconds) ? saved.zenSeconds : 0,
    cocktails: saved.cocktails && typeof saved.cocktails === 'object' ? { date: String(saved.cocktails.date ?? ''), count: Number(saved.cocktails.count) || 0 } : base.cocktails,
    bottles: cleanBottles(saved.bottles),
    reportedIds: Array.isArray(saved.reportedIds) ? saved.reportedIds.filter(x => typeof x === 'string') : [],
    lastSeenReplyAt: typeof saved.lastSeenReplyAt === 'string' ? saved.lastSeenReplyAt : '',
    // 옛 프로필엔 조개가 없다 → 3개로 시작. 이상한 값도 3개
    shells: Number.isInteger(saved.shells) && saved.shells >= 0 && saved.shells <= MAX_SHELLS ? saved.shells : START_SHELLS,
    drink: cleanDrink(saved.drink),
    tube: TUBES.includes(saved.tube) ? saved.tube : null
  };
}
