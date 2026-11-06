// 이 파일이 하는 일: 프레임 속도(fps)를 재고, 30fps에 못 미치면 그래픽 품질을 낮추자고 판단한다
export const QUALITY_THRESHOLD = 30;   // fps
export const MEASURE_SECONDS = 3;
export const MEASURE_FRAMES = 180;
const IGNORE_ABOVE = 0.5;              // 0.5초보다 긴 프레임은 탭 전환·멈춤이라 측정에서 뺀다

export class FpsMeter {
  constructor() { this.samples = 0; this.elapsed = 0; }
  push(dt) {
    if (!(dt > 0) || dt > IGNORE_ABOVE) return;
    this.samples += 1;
    this.elapsed += dt;
  }
  average() { return this.elapsed > 0 ? this.samples / this.elapsed : 0; }
  get done() { return this.elapsed >= MEASURE_SECONDS || this.samples >= MEASURE_FRAMES; }
}

export function decideQuality(avgFps) {
  return avgFps < QUALITY_THRESHOLD ? 'low' : 'high';
}
