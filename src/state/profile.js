// 이 파일이 하는 일: "내 정보"의 기본 모양(토큰·닉네임·꾸미기·칵테일 횟수·석양멍 시간·내 병 목록)을 정의하고, 꾸미기 값이 허용 범위인지 정리한다
import { validateBottle } from './bottles.js';

export const HATS = ['straw', 'bucket', 'none'];
export const SHIRT_COUNT = 6;
export const COCKTAIL_COUNT = 4;
export const DEFAULT_LOOK = Object.freeze({ hat: 'straw', glasses: true, shirt: 0, cocktail: 0 });

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
  return { hat, glasses, shirt, cocktail };
}

export function defaultProfile() {
  return {
    token: randomUUID(),
    nickname: '',
    look: { ...DEFAULT_LOOK },
    zenSeconds: 0,
    cocktails: { date: '', count: 0 },
    bottles: []
  };
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
    bottles: cleanBottles(saved.bottles)
  };
}
