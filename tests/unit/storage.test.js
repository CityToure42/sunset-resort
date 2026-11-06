// 이 파일이 하는 일: 폰 저장소(localStorage) 래퍼가 없을 때·깨졌을 때·막혔을 때 어떻게 행동하는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStorage, STORAGE_KEY } from '../../src/state/storage.js';

function fakeLS(initial = {}) {
  const m = new Map(Object.entries(initial));
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
}

test('저장된 게 없으면 빈 객체', () => {
  assert.deepEqual(createStorage(fakeLS()).load(), {});
});

test('save 후 load가 같다', () => {
  const s = createStorage(fakeLS());
  assert.equal(s.save({ nickname: '세민', n: 1 }), true);
  assert.deepEqual(s.load(), { nickname: '세민', n: 1 });
});

test('깨진 JSON이면 빈 객체', () => {
  const ls = fakeLS({ [STORAGE_KEY]: '{oops' });
  assert.deepEqual(createStorage(ls).load(), {});
});

test('백엔드가 throw 하면 메모리 폴백, isPersistent=false', () => {
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const s = createStorage(broken);
  assert.equal(s.isPersistent, false);
  assert.equal(s.save({ a: 1 }), false);
  assert.deepEqual(s.load(), { a: 1 });
});

test('C1: localStorage에 접근만 해도 예외가 나는 브라우저에서도 만들어지고 메모리로 동작', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('SecurityError'); } });
  try {
    const s = createStorage();
    assert.equal(s.isPersistent, false);
    assert.deepEqual(s.load(), {});
    assert.equal(s.save({ a: 1 }), false);
    assert.deepEqual(s.load(), { a: 1 });
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc); else delete globalThis.localStorage;
  }
});
