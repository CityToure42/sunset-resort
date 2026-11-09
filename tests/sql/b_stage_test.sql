-- 이 파일이 하는 일: 서버 규칙 테스트. anon(앱이 쓰는 익명 권한)으로 창구 함수를 불러 약속대로 동작하는지 확인한다. 실패하면 RAISE EXCEPTION으로 멈춘다
\set QUIET on
-- 토큰 A=주인, B·C·D·E=다른 폰
\set A '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'''
\set B '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'''
\set C '''cccccccc-cccc-4ccc-8ccc-cccccccccccc'''
\set D '''dddddddd-dddd-4ddd-8ddd-dddddddddddd'''

set role anon;

-- anon_cannot_select_tables
do $$ begin
  begin perform * from bottles; raise exception 'anon_cannot_select_tables: select succeeded';
  exception when insufficient_privilege then null; end;
  begin perform * from replies; raise exception 'anon_cannot_select_tables: replies';
  exception when insufficient_privilege then null; end;
end $$;

-- anon_cannot_insert_directly
do $$ begin
  begin
    insert into bottles(owner_token, nickname, shape, message, x, z) values (gen_random_uuid(), '세민', 'round', 'hi', 0, -18);
    raise exception 'anon_cannot_insert_directly: insert succeeded';
  exception when insufficient_privilege then null; end;
end $$;

-- create_and_list
create temp table t_ids(name text primary key, id uuid);
grant all on t_ids to anon;
do $$
declare b jsonb; l jsonb;
begin
  b := create_bottle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '  세민 ', 'round', '  안녕 바다  ', 0, -18);
  if b->>'nickname' <> '세민' or b->>'message' <> '안녕 바다' then raise exception 'create_and_list: trim %', b; end if;
  if (b->>'is_mine')::boolean is not true then raise exception 'create_and_list: create is_mine %', b; end if;
  insert into t_ids values ('first', (b->>'id')::uuid);
  l := list_bottles('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if jsonb_array_length(l) <> 1 or (l->0->>'is_mine')::boolean is not true then raise exception 'create_and_list: list A %', l; end if;
  l := list_bottles('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if (l->0->>'is_mine')::boolean is not false then raise exception 'create_and_list: list B %', l; end if;
end $$;

-- reject_invalid
do $$
declare bad record; ok boolean;
begin
  for bad in select * from (values
      ('세민', 'round', repeat('가', 51), 0::real, -18::real, 'msg51'),
      ('세민', 'round', '   ', 0, -18, 'blank'),
      ('세', 'round', 'hi', 0, -18, 'nick1'),
      ('세민!', 'round', 'hi', 0, -18, 'nickchar'),
      ('세민', 'cup', 'hi', 0, -18, 'shape'),
      ('세민', 'round', 'hi', 19, -18, 'x19'),
      ('세민', 'round', 'hi', 0, 0, 'z0')
    ) v(nick, shape, msg, x, z, label)
  loop
    ok := false;
    begin
      perform create_bottle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', bad.nick, bad.shape, bad.msg, bad.x, bad.z);
    exception when others then ok := true; end;
    if not ok then raise exception 'reject_invalid: % accepted', bad.label; end if;
  end loop;
  -- 50자는 통과
  perform create_bottle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '세민', 'star', repeat('가', 50), 18, -24);
end $$;

-- like_once_per_device
do $$
declare id uuid := (select t.id from t_ids t where name = 'first'); r jsonb;
begin
  r := like_bottle('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id);
  r := like_bottle('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id);
  if (r->>'likes')::int <> 1 then raise exception 'like_once_per_device: same device %', r; end if;
  r := like_bottle('cccccccc-cccc-4ccc-8ccc-cccccccccccc', id);
  if (r->>'likes')::int <> 2 then raise exception 'like_once_per_device: second device %', r; end if;
  if (get_bottle(id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')->>'liked_by_me')::boolean is not true then raise exception 'like_once_per_device: liked_by_me'; end if;
  if (get_bottle(id, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd')->>'liked_by_me')::boolean is not false then raise exception 'like_once_per_device: not liked'; end if;
end $$;

-- reply_rules (숨기기 전)
do $$
declare id uuid := (select t.id from t_ids t where name = 'first'); r jsonb; g jsonb; ok boolean := false;
begin
  r := add_reply('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, '친구', ' 예쁘다 ');
  if r->>'message' <> '예쁘다' then raise exception 'reply_rules: trim %', r; end if;
  g := get_bottle(id, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');
  if jsonb_array_length(g->'replies') <> 1 or g->'replies'->0->>'nickname' <> '친구' then raise exception 'reply_rules: get %', g; end if;
  begin perform add_reply('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, '친구', repeat('가', 51)); exception when others then ok := true; end;
  if not ok then raise exception 'reply_rules: 51 accepted'; end if;
end $$;

-- owner_report_ignored + report_hides_after_three_devices
do $$
declare id uuid := (select t.id from t_ids t where name = 'first'); r jsonb; l jsonb; m jsonb; ok boolean := false;
begin
  r := report_bottle('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id);
  r := report_bottle('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id);
  r := report_bottle('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id);
  r := report_bottle('cccccccc-cccc-4ccc-8ccc-cccccccccccc', id);
  if (r->>'hidden')::boolean then raise exception 'report: hidden too early (owner or duplicate counted) %', r; end if;
  r := report_bottle('dddddddd-dddd-4ddd-8ddd-dddddddddddd', id);
  if not (r->>'hidden')::boolean then raise exception 'report_hides_after_three_devices: %', r; end if;
  l := list_bottles('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if exists (select 1 from jsonb_array_elements(l) e where (e->>'id')::uuid = id) then raise exception 'report: still listed'; end if;
  m := my_bottles('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if not exists (select 1 from jsonb_array_elements(m) e where (e->>'id')::uuid = id and (e->>'hidden')::boolean) then raise exception 'report: my_bottles missing hidden %', m; end if;
  if get_bottle(id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') is not null and get_bottle(id, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') <> 'null'::jsonb then raise exception 'report: others can still get'; end if;
  if get_bottle(id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') is null then raise exception 'report: owner cannot get'; end if;
  -- hidden_not_visible_with_null_token: 토큰을 null로 보내도 숨겨진 병을 볼 수 없어야 한다(null 비교는 거짓이 아니라 '모름'이 됨)
  if get_bottle(id, null) is not null and get_bottle(id, null) <> 'null'::jsonb then raise exception 'hidden_not_visible_with_null_token: %', get_bottle(id, null); end if;
  begin perform add_reply('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id, '친구', '또'); exception when others then ok := true; end;
  if not ok then raise exception 'reply_rules: reply to hidden accepted'; end if;
end $$;

-- my_bottles shape
do $$
declare m jsonb; first jsonb;
begin
  m := my_bottles('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  if jsonb_array_length(m) <> 2 then raise exception 'my_bottles: count %', jsonb_array_length(m); end if;
  select e into first from jsonb_array_elements(m) e where (e->>'hidden')::boolean;
  if (first->>'reply_count')::int <> 1 or first->>'last_reply_at' is null or jsonb_array_length(first->'replies') <> 1 then raise exception 'my_bottles: reply fields %', first; end if;
  if jsonb_array_length(my_bottles('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')) <> 0 then raise exception 'my_bottles: B has none'; end if;
end $$;

-- no_token_in_responses
do $$
declare id uuid := (select t.id from t_ids t where name = 'first'); txt text;
begin
  txt := list_bottles('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text || get_bottle(id, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text || my_bottles('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')::text;
  if txt ilike '%token%' or txt ilike '%aaaaaaaa-aaaa%' or txt ilike '%bbbbbbbb-bbbb%' then raise exception 'no_token_in_responses: %', left(txt, 300); end if;
end $$;

-- list_limit_200
do $$
declare l jsonb;
begin
  for i in 1..205 loop
    perform create_bottle('cccccccc-cccc-4ccc-8ccc-cccccccccccc', '친구', 'jar', '편지 ' || i, 0, -18);
  end loop;
  l := list_bottles('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  if jsonb_array_length(l) <> 200 then raise exception 'list_limit_200: %', jsonb_array_length(l); end if;
  if l->0->>'message' <> '편지 205' then raise exception 'list_limit_200: not newest first %', l->0->>'message'; end if;
end $$;

-- cascade_delete (관리자 권한)
reset role;
do $$
declare v_id uuid := (select t.id from t_ids t where name = 'first');
begin
  if not exists (select 1 from replies r where r.bottle_id = v_id) then raise exception 'cascade_delete: setup has no replies'; end if;
  delete from bottles where bottles.id = v_id;
  if exists (select 1 from replies r where r.bottle_id = v_id) or exists (select 1 from likes l where l.bottle_id = v_id) or exists (select 1 from reports r where r.bottle_id = v_id) then
    raise exception 'cascade_delete: leftovers';
  end if;
end $$;
