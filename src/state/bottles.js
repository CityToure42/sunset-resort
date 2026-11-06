// 이 파일이 하는 일: 유리병 편지의 규칙(모양 6종, 메시지 1~50자, 앞바다 구역)을 검사하고, 내가 띄운 병들을 폰에 저장·조회한다. B단계에서는 같은 모양의 서버 버전으로 바꿔 끼운다
export const SHAPES = ['round', 'tall', 'square', 'jar', 'heart', 'star'];
export const SHAPE_LABELS = { round: '둥근병', tall: '긴병', square: '네모병', jar: '항아리', heart: '하트병', star: '별병' };
export const BOTTLE_AREA = Object.freeze({ xMin: -18, xMax: 18, zMin: -24, zMax: -12 });
export const MESSAGE_MAX = 50;

export function clampToBottleArea({ x, z }) {
  return {
    x: Math.min(BOTTLE_AREA.xMax, Math.max(BOTTLE_AREA.xMin, x)),
    z: Math.min(BOTTLE_AREA.zMax, Math.max(BOTTLE_AREA.zMin, z))
  };
}

export function validateBottle({ shape, message, x, z }) {
  if (!SHAPES.includes(shape)) return { ok: false, reason: 'shape' };
  const msg = String(message ?? '').trim();
  if (msg.length < 1 || msg.length > MESSAGE_MAX) return { ok: false, reason: 'message' };
  const inArea = Number.isFinite(x) && Number.isFinite(z) &&
    x >= BOTTLE_AREA.xMin && x <= BOTTLE_AREA.xMax && z >= BOTTLE_AREA.zMin && z <= BOTTLE_AREA.zMax;
  if (!inArea) return { ok: false, reason: 'position' };
  return { ok: true, value: { shape, message: msg, x, z } };
}

function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

// 폰 저장 버전. profileBottles는 프로필 안의 배열 그 자체라서 save()만 부르면 프로필과 함께 저장된다
export class BottleStore {
  constructor(profileBottles, save) {
    this.items = profileBottles;
    this.save = save;
  }

  add({ shape, message, x, z, nickname = '' }) {
    const v = validateBottle({ shape, message, x, z });
    if (!v.ok) throw new Error(`invalid bottle: ${v.reason}`);
    const bottle = { id: uuid(), ...v.value, nickname, createdAt: new Date().toISOString(), likes: 0 };
    this.items.push(bottle);
    this.save();
    return bottle;
  }

  list() {
    return [...this.items].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }
}
