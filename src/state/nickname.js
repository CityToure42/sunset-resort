// 이 파일이 하는 일: 닉네임 추천("나른한 코코넛")을 만들고, 사용자가 적은 닉네임이 규칙(2~10자, 한글·영문·숫자)에 맞는지 검사한다
export const ADJECTIVES = ['나른한', '느긋한', '선셋', '포근한', '반짝이는', '달콤한', '시원한', '몽글한', '여유로운', '노을빛', '살랑이는', '보송한', '따뜻한', '잔잔한'];
export const NOUNS = ['코코넛', '플라밍고', '파라솔', '칵테일', '모히또', '야자수', '파도', '조개', '선베드', '망고', '파인애플', '불가사리', '튜브', '석양'];

export function suggestNickname(rng = Math.random) {
  const pick = list => list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
  return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export const NICK_MIN = 2;
export const NICK_MAX = 10;
const ALLOWED = /^[가-힣A-Za-z0-9 ]+$/;

export function validateNickname(raw) {
  const value = String(raw ?? '').trim();
  if (value.length < NICK_MIN || value.length > NICK_MAX) return { ok: false, reason: 'length' };
  if (!ALLOWED.test(value)) return { ok: false, reason: 'chars' };
  return { ok: true, value };
}
