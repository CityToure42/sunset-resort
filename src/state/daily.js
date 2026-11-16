// 이 파일이 하는 일: 한국시간(KST) 기준 "오늘" 날짜와 시·분을 계산한다(석양 무드·이벤트 시각에 쓴다)
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
