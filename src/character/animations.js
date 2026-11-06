// 이 파일이 하는 일: 캐릭터의 동작 상태(가만히·걷기·인사·건배·춤·눕기·비치볼·마시기)를 관리하고, 매 프레임 팔·다리·몸의 각도를 계산해 움직여 준다
export const EMOTES = { wave: 1.6, cheers: 1.4, dance: 2.4, lie: Infinity, throw: 1.2, drink: 1.5 };

const WALK_FREQ = Math.PI * 2 * 2.2;   // 걷기 주파수(초당 2.2걸음)
const REST = { armR: { x: -1.35, z: -0.25 }, armL: { x: 0, z: 0.18 } }; // 가만히 있을 때 팔 각도(칵테일 든 자세)
const lerp = (a, b, k) => a + (b - a) * k;

export class AnimationController {
  constructor(parts, group) {
    this.parts = parts;
    this.group = group;
    this.state = 'idle';
    this.t = 0;          // 현재 상태에 머문 시간
    this.moving = false;
  }

  setMoving(on) {
    this.moving = !!on;
    if (this.moving && this.state !== 'walk') { this.state = 'walk'; this.t = 0; }
    if (!this.moving && this.state === 'walk') { this.state = 'idle'; this.t = 0; }
  }

  play(name) {
    if (!(name in EMOTES)) return;
    this.moving = false;
    this.state = name;
    this.t = 0;
  }

  stop() {
    this.state = this.moving ? 'walk' : 'idle';
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    const p = this.parts, g = this.group;
    const s = this.state;
    if (s in EMOTES && this.t >= EMOTES[s]) { this.state = this.moving ? 'walk' : 'idle'; this.t = 0; }

    // 기본값: 서 있는 자세로 서서히 복귀 (k는 '얼마나 빨리 제자리로'의 비율)
    const k = Math.min(1, dt * 10);
    const target = { legL: 0, legR: 0, armLx: REST.armL.x, armRx: REST.armR.x, armRz: REST.armR.z, bodyY: 0, groupX: 0, groupY: 0 };
    const t = this.t;

    switch (this.state) {
      case 'walk': {
        const sw = Math.sin(t * WALK_FREQ) * 0.6;
        target.legL = sw; target.legR = -sw; target.armLx = -sw * 0.7;
        break;
      }
      case 'wave':
        target.armLx = -2.6 + Math.sin(t * 14) * 0.3;   // 왼팔을 들고 흔들기
        break;
      case 'cheers':
        target.armRx = -2.4; target.armRz = -0.5;       // 오른팔(칵테일) 높이 들기
        break;
      case 'dance':
        target.bodyY = Math.sin(t * 8) * 0.45;
        target.armLx = -1.5 + Math.sin(t * 8) * 0.5; target.armRx = -1.5 - Math.sin(t * 8) * 0.5;
        target.legL = Math.sin(t * 8) * 0.2; target.legR = -Math.sin(t * 8) * 0.2;
        break;
      case 'lie':
        target.groupX = -Math.PI / 2 + 0.35; target.groupY = 0.5;   // 뒤로 누움(선베드 각도)
        target.armRx = -0.9; target.armLx = -0.3;
        break;
      case 'throw':
        target.armRx = t < 0.5 ? -2.8 : -0.6;              // 뒤로 젖혔다가 던지기
        break;
      case 'drink':
        target.armRx = -2.1; target.armRz = -0.9;         // 잔을 입으로
        break;
      default: break;
    }

    p.legL.rotation.x = lerp(p.legL.rotation.x, target.legL, k);
    p.legR.rotation.x = lerp(p.legR.rotation.x, target.legR, k);
    p.armL.rotation.x = lerp(p.armL.rotation.x, target.armLx, k);
    p.armR.rotation.x = lerp(p.armR.rotation.x, target.armRx, k);
    p.armR.rotation.z = lerp(p.armR.rotation.z, target.armRz, k);
    if (p.body) p.body.rotation.y = lerp(p.body.rotation.y, target.bodyY, k);
    if (g) { g.rotation.x = lerp(g.rotation.x, target.groupX, k); g.position.y = lerp(g.position.y, target.groupY, k); }
  }
}
