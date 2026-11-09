// 이 파일이 하는 일: 가짜 Supabase가 진짜 서버 SQL과 같은 규칙으로 답하는지 브라우저 fetch로 확인 (가짜가 틀리면 다른 테스트를 믿을 수 없으므로)
import { test, expect } from '@playwright/test';
import { installFakeSupabase, SUPABASE_URL } from './fake-supabase.mjs';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', D = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

async function setup(page) {
  const fake = await installFakeSupabase(page);
  await page.goto('/tests/e2e/blank.html');
  const rpc = (fn, body) => page.evaluate(async ([url, fn, body]) => {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: 'k', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: r.status, data: await r.json() };
  }, [SUPABASE_URL, fn, body]);
  return { fake, rpc };
}

test('create_and_list: 내 것 표시, 남에게는 아님', async ({ page }) => {
  const { rpc } = await setup(page);
  const c = await rpc('create_bottle', { p_token: A, p_nickname: ' 세민 ', p_shape: 'round', p_message: ' 안녕 ', p_x: 0, p_z: -18 });
  expect(c.status).toBe(200);
  expect(c.data).toMatchObject({ nickname: '세민', message: '안녕', is_mine: true });
  expect((await rpc('list_bottles', { p_token: A })).data[0].is_mine).toBe(true);
  expect((await rpc('list_bottles', { p_token: B })).data[0].is_mine).toBe(false);
});

test('reject_invalid: 51자·1글자 닉네임·없는 모양·범위 밖 → 400', async ({ page }) => {
  const { rpc } = await setup(page);
  const base = { p_token: A, p_nickname: '세민', p_shape: 'round', p_message: 'hi', p_x: 0, p_z: -18 };
  for (const bad of [{ p_message: '가'.repeat(51) }, { p_nickname: '세' }, { p_shape: 'cup' }, { p_x: 19 }, { p_z: 0 }, { p_message: '   ' }]) {
    expect((await rpc('create_bottle', { ...base, ...bad })).status).toBe(400);
  }
  expect((await rpc('create_bottle', { ...base, p_message: '가'.repeat(50) })).status).toBe(200);
});

test('like_once: 같은 폰은 한 번', async ({ page }) => {
  const { rpc } = await setup(page);
  const id = (await rpc('create_bottle', { p_token: A, p_nickname: '세민', p_shape: 'round', p_message: 'hi', p_x: 0, p_z: -18 })).data.id;
  await rpc('like_bottle', { p_token: B, p_bottle_id: id });
  expect((await rpc('like_bottle', { p_token: B, p_bottle_id: id })).data.likes).toBe(1);
  expect((await rpc('like_bottle', { p_token: C, p_bottle_id: id })).data.likes).toBe(2);
});

test('report_hides: 주인·중복 무시, 서로 다른 3폰이면 숨김, 주인 my_bottles엔 남음', async ({ page }) => {
  const { rpc } = await setup(page);
  const id = (await rpc('create_bottle', { p_token: A, p_nickname: '세민', p_shape: 'round', p_message: 'hi', p_x: 0, p_z: -18 })).data.id;
  await rpc('report_bottle', { p_token: A, p_bottle_id: id });
  await rpc('report_bottle', { p_token: B, p_bottle_id: id });
  await rpc('report_bottle', { p_token: B, p_bottle_id: id });
  expect((await rpc('report_bottle', { p_token: C, p_bottle_id: id })).data.hidden).toBe(false);
  expect((await rpc('report_bottle', { p_token: D, p_bottle_id: id })).data.hidden).toBe(true);
  expect((await rpc('list_bottles', { p_token: B })).data).toEqual([]);
  expect((await rpc('get_bottle', { p_id: id, p_token: B })).data).toBe(null);
  expect((await rpc('my_bottles', { p_token: A })).data[0].hidden).toBe(true);
  const hiddenReply = await rpc('add_reply', { p_token: B, p_bottle_id: id, p_nickname: '친구', p_message: 'x' });
  expect(hiddenReply.status).toBe(500);   // 진짜 PostgREST: P0002 → 500
  expect(hiddenReply.data.code).toBe('P0002');
});

test('no_token: 응답 어디에도 토큰 없음, setFail로 오류 흉내', async ({ page }) => {
  const { rpc, fake } = await setup(page);
  await rpc('create_bottle', { p_token: A, p_nickname: '세민', p_shape: 'round', p_message: 'hi', p_x: 0, p_z: -18 });
  const all = JSON.stringify([(await rpc('list_bottles', { p_token: A })).data, (await rpc('my_bottles', { p_token: A })).data]);
  expect(all).not.toContain('token');
  expect(all).not.toContain(A);
  fake.setFail(500);
  expect((await rpc('list_bottles', { p_token: A })).status).toBe(500);
});
