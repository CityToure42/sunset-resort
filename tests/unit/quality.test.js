// 이 파일이 하는 일: 프레임 속도 측정(FpsMeter)과 그래픽 품질 결정(30fps 기준)이 맞는지, 저장소가 '쓰기만 막힌' 경우도 알아채는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FpsMeter, decideQuality, QUALITY_THRESHOLD } from '../../src/state/quality.js';
import { createStorage } from '../../src/state/storage.js';

test('기준은 30fps: 29.9 → low, 30 → high', () => {
  assert.equal(QUALITY_THRESHOLD, 30);
  assert.equal(decideQuality(29.9), 'low');
  assert.equal(decideQuality(30), 'high');
  assert.equal(decideQuality(60), 'high');
});

test('FpsMeter: 1/60초 프레임 60개 → 평균 60fps, 1초', () => {
  const m = new FpsMeter();
  for (let i = 0; i < 60; i++) m.push(1 / 60);
  assert.equal(m.samples, 60);
  assert.ok(Math.abs(m.average() - 60) < 1e-6);
  assert.ok(Math.abs(m.elapsed - 1) < 1e-9);
});

test('FpsMeter: 0.5초 넘는 프레임(탭 전환 등)은 무시', () => {
  const m = new FpsMeter();
  m.push(1 / 30); m.push(5); m.push(1 / 30);
  assert.equal(m.samples, 2);
  assert.ok(Math.abs(m.average() - 30) < 1e-6);
});

test('FpsMeter: 아무것도 없으면 평균 0', () => {
  assert.equal(new FpsMeter().average(), 0);
});

test('저장소: 읽기는 되고 쓰기만 막혀도 처음부터 isPersistent=false', () => {
  const ls = { getItem: () => null, setItem() { throw new Error('QuotaExceeded'); }, removeItem() {} };
  assert.equal(createStorage(ls).isPersistent, false);
});
