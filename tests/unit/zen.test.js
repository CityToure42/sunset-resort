// 이 파일이 하는 일: 석양멍 경과 시간 표시 문구(formatZen)가 약속대로인지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatZen } from '../../src/ui/zen.js';

test('60초 미만은 "잠시"', () => {
  assert.equal(formatZen(0), '잠시');
  assert.equal(formatZen(30), '잠시');
  assert.equal(formatZen(59), '잠시');
});

test('분 단위: 60초 → 1분째, 180초 → 3분째, 3599초 → 59분째', () => {
  assert.equal(formatZen(60), '1분째');
  assert.equal(formatZen(180), '3분째');
  assert.equal(formatZen(3599), '59분째');
});

test('시간 단위: 4320초 → 1시간 12분째, 3600초 → 1시간째', () => {
  assert.equal(formatZen(4320), '1시간 12분째');
  assert.equal(formatZen(3600), '1시간째');
});
