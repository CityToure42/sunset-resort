// 이 파일이 하는 일: 한국시간(KST) 기준 "오늘" 날짜를 계산하고, 하루 5잔까지 받는 오늘의 칵테일 카운터를 관리한다
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// Date → 'YYYY-MM-DD' (UTC+9 기준). 타임존 라이브러리 없이 9시간을 더한 뒤 UTC 필드를 읽는다
export function kstDateKey(date = new Date()) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// KST 기준 시·분 (무드 계산 등에 사용)
export function kstHourMinute(date = new Date()) {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return { hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes() };
}

export const COCKTAILS_PER_DAY = 5;

export class CocktailCounter {
  constructor(state = { date: '', count: 0 }, max = COCKTAILS_PER_DAY) {
    this.date = state?.date ?? '';
    this.count = Number(state?.count) || 0;
    this.max = max;
  }

  // 날짜가 바뀌었으면 0부터 다시 센다
  #rollover(now) {
    const key = kstDateKey(now);
    if (key !== this.date) { this.date = key; this.count = 0; }
  }

  take(now = new Date()) {
    this.#rollover(now);
    if (this.count >= this.max) return { ok: false, count: this.count };
    this.count += 1;
    return { ok: true, count: this.count };
  }

  remaining(now = new Date()) {
    this.#rollover(now);
    return this.max - this.count;
  }

  toJSON() { return { date: this.date, count: this.count }; }
}
