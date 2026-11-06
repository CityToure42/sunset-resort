// 이 파일이 하는 일: 하늘·바다·조명 색 묶음(팔레트) 3종을 정의하고, 지금 시각(KST)에 어떤 분위기를 써야 하는지 고른다
import { kstHourMinute } from './daily.js';

export const EVENT_HOUR = 19;          // 매일 오후 7시 석양 이벤트
export const GOLDEN_START = 18 * 60 + 30; // 18:30 (분 단위)
export const EVENT_START = EVENT_HOUR * 60;
export const EVENT_END = EVENT_START + 30;  // 19:30

export const PALETTES = {
  pastel:   { top: '#4b3f86', mid: '#c76f8f', horizon: '#ffbb95', sun: '#fff0c0', glow: '#ffd9a8', water: '#4a7fb5', fog: '#ffb996', light: '#ffcfa8', lightIntensity: 1.5, hemiSky: '#c6a0ff', hemiGround: '#e4c89a' },
  dramatic: { top: '#160d33', mid: '#8a2d6e', horizon: '#ff6a2e', sun: '#ffc46b', glow: '#ff9a4a', water: '#2d4b7d', fog: '#ff7c45', light: '#ffa164', lightIntensity: 1.7, hemiSky: '#8a5cff', hemiGround: '#d9b98a' },
  golden:   { top: '#5d8fc9', mid: '#f0b06e', horizon: '#ffe4b0', sun: '#fff7d2', glow: '#ffe8b0', water: '#3c82c4', fog: '#ffe0a8', light: '#ffe6b8', lightIntensity: 1.6, hemiSky: '#9ec1ff', hemiGround: '#e9d3a8' }
};

export function moodAt(date = new Date()) {
  const { hour, minute } = kstHourMinute(date);
  const t = hour * 60 + minute;
  if (t >= EVENT_START && t < EVENT_END) return 'dramatic';
  if (t >= GOLDEN_START && t < EVENT_START) return 'golden';
  return 'pastel';
}
