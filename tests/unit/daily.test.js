// 이 파일이 하는 일: 한국시간 날짜 계산과 "오늘의 칵테일" 카운터(하루 5잔, 자정 초기화)가 맞는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kstDateKey } from '../../src/state/daily.js';

const utc = s => new Date(s);

test('UTC 2026-11-04T14:59Z는 KST 11-04, 15:00Z는 11-05', () => {
  assert.equal(kstDateKey(utc('2026-11-04T14:59:00Z')), '2026-11-04');
  assert.equal(kstDateKey(utc('2026-11-04T15:00:00Z')), '2026-11-05');
});

