// 이 파일이 하는 일: 닉네임 추천이 규칙에 맞게 나오는지, 검증이 길이·문자 규칙을 지키는지 확인
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestNickname, validateNickname, ADJECTIVES, NOUNS } from '../../src/state/nickname.js';

test('추천은 형용사+공백+명사이고 검증을 통과한다', () => {
  for (let i = 0; i < 20; i++) {
    const n = suggestNickname();
    const [adj, noun, extra] = n.split(' ');
    assert.ok(ADJECTIVES.includes(adj), `형용사 목록에 없음: ${adj}`);
    assert.ok(NOUNS.includes(noun), `명사 목록에 없음: ${noun}`);
    assert.equal(extra, undefined);
    assert.equal(validateNickname(n).ok, true);
  }
});

test('단어 목록은 각각 12개 이상', () => {
  assert.ok(ADJECTIVES.length >= 12 && NOUNS.length >= 12);
});

test('앞뒤 공백은 지워진다: "  바다  " → 바다', () => {
  assert.deepEqual(validateNickname('  바다  '), { ok: true, value: '바다' });
});

test('"a"는 너무 짧다 → length', () => {
  assert.deepEqual(validateNickname('a'), { ok: false, reason: 'length' });
});

test('11자는 너무 길다 → length', () => {
  assert.deepEqual(validateNickname('가나다라마바사아자차카'), { ok: false, reason: 'length' });
});

test('특수문자는 안 된다: "hi!" → chars', () => {
  assert.deepEqual(validateNickname('hi!'), { ok: false, reason: 'chars' });
});

test('한글·영문·숫자 섞인 10자는 통과', () => {
  assert.deepEqual(validateNickname('선셋Semin1 2'), { ok: true, value: '선셋Semin1 2' });
});
