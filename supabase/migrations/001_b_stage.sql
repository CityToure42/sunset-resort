-- 이 파일이 하는 일: B단계 서버 — 유리병·답글·좋아요·신고 표를 만들고, 표는 완전히 잠근 뒤 앱이 쓸 "창구 함수" 7개만 열어 준다.
-- Supabase SQL 편집기에 통째로 붙여 넣어 실행한다. 여러 번 실행해도 안전하다.

-- ---------- 표 ----------
create table if not exists bottles (
  id uuid primary key default gen_random_uuid(),
  owner_token uuid not null,
  nickname text not null check (nickname ~ '^[가-힣A-Za-z0-9 ]{2,10}$'),
  shape text not null check (shape in ('round', 'tall', 'square', 'jar', 'heart', 'star')),
  message text not null check (char_length(message) between 1 and 50),
  x real not null check (x between -18 and 18),
  z real not null check (z between -24 and -12),
  created_at timestamptz not null default now(),
  likes int not null default 0,
  reports int not null default 0
);
create index if not exists bottles_created_at_idx on bottles (created_at desc);
create index if not exists bottles_owner_idx on bottles (owner_token);

create table if not exists replies (
  id uuid primary key default gen_random_uuid(),
  bottle_id uuid not null references bottles(id) on delete cascade,
  author_token uuid not null,
  nickname text not null check (nickname ~ '^[가-힣A-Za-z0-9 ]{2,10}$'),
  message text not null check (char_length(message) between 1 and 50),
  created_at timestamptz not null default now()
);
create index if not exists replies_bottle_idx on replies (bottle_id, created_at);

create table if not exists likes (
  bottle_id uuid not null references bottles(id) on delete cascade,
  device_token uuid not null,
  primary key (bottle_id, device_token)
);

create table if not exists reports (
  bottle_id uuid not null references bottles(id) on delete cascade,
  device_token uuid not null,
  primary key (bottle_id, device_token)
);

-- ---------- 잠그기: 앱(anon)은 표를 직접 읽거나 쓸 수 없다 ----------
alter table bottles enable row level security;
alter table replies enable row level security;
alter table likes enable row level security;
alter table reports enable row level security;
revoke all on bottles, replies, likes, reports from public, anon, authenticated;

-- ---------- 내부 도우미 ----------
-- 앱에 보여 줄 병 모양(토큰 없음)
create or replace function _bottle_json(b bottles, p_token uuid) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', b.id, 'nickname', b.nickname, 'shape', b.shape, 'message', b.message,
    'x', b.x, 'z', b.z, 'created_at', b.created_at, 'likes', b.likes,
    'is_mine', b.owner_token = p_token)
$$;

create or replace function _reply_json(r replies) returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object('id', r.id, 'nickname', r.nickname, 'message', r.message, 'created_at', r.created_at)
$$;

-- ---------- 창구 함수 7개 ----------
-- 1. 숨겨지지 않은 최근 병 200개
create or replace function list_bottles(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(_bottle_json(b, p_token) order by b.created_at desc), '[]'::jsonb)
  from (select * from bottles where reports < 3 order by created_at desc limit 200) b
$$;

-- 2. 병 하나 + 내가 좋아요 했는지 + 답글(최신 50개를 오래된 순으로). 숨겨진 병은 주인에게만
create or replace function get_bottle(p_id uuid, p_token uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b bottles;
begin
  select * into b from bottles where id = p_id;
  if not found or (b.reports >= 3 and b.owner_token is distinct from p_token) then return null; end if;   -- is distinct from: p_token이 null이어도 "다르다"로 본다
  return jsonb_build_object(
    'bottle', _bottle_json(b, p_token),
    'liked_by_me', exists (select 1 from likes l where l.bottle_id = p_id and l.device_token = p_token),
    'replies', coalesce((select jsonb_agg(_reply_json(r) order by r.created_at)
                         from (select * from replies where bottle_id = p_id order by created_at desc limit 50) r), '[]'::jsonb));
end $$;

-- 3. 병 띄우기
create or replace function create_bottle(p_token uuid, p_nickname text, p_shape text, p_message text, p_x real, p_z real) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bottles;
begin
  insert into bottles (owner_token, nickname, shape, message, x, z)
  values (p_token, btrim(p_nickname), p_shape, btrim(p_message), p_x, p_z)
  returning * into b;
  return _bottle_json(b, p_token);
end $$;

-- 4. 답글 달기 (숨겨진·없는 병에는 불가)
create or replace function add_reply(p_token uuid, p_bottle_id uuid, p_nickname text, p_message text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r replies;
begin
  if not exists (select 1 from bottles where id = p_bottle_id and reports < 3) then
    raise exception 'bottle not found' using errcode = 'P0002';
  end if;
  insert into replies (bottle_id, author_token, nickname, message)
  values (p_bottle_id, p_token, btrim(p_nickname), btrim(p_message))
  returning * into r;
  return _reply_json(r);
end $$;

-- 5. 좋아요 (같은 폰은 한 번만)
create or replace function like_bottle(p_token uuid, p_bottle_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int; total int;
begin
  if not exists (select 1 from bottles where id = p_bottle_id and reports < 3) then
    raise exception 'bottle not found' using errcode = 'P0002';
  end if;
  insert into likes (bottle_id, device_token) values (p_bottle_id, p_token) on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then update bottles set likes = likes + 1 where id = p_bottle_id; end if;
  select likes into total from bottles where id = p_bottle_id;
  return jsonb_build_object('likes', total);
end $$;

-- 6. 신고 (같은 폰 중복·자기 병은 세지 않음, 서로 다른 폰 3개면 숨김)
create or replace function report_bottle(p_token uuid, p_bottle_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare b bottles; n int;
begin
  select * into b from bottles where id = p_bottle_id;
  if not found then raise exception 'bottle not found' using errcode = 'P0002'; end if;
  if b.owner_token is distinct from p_token then
    insert into reports (bottle_id, device_token) values (p_bottle_id, p_token) on conflict do nothing;
    get diagnostics n = row_count;
    if n > 0 then update bottles set reports = reports + 1 where id = p_bottle_id returning * into b; end if;
  end if;
  return jsonb_build_object('hidden', b.reports >= 3);
end $$;

-- 7. 내 병 전체(숨겨진 것 포함) + 답글 수·마지막 답글 시각·최신 답글 20개
create or replace function my_bottles(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(
    _bottle_json(b, p_token) || jsonb_build_object(
      'hidden', b.reports >= 3,
      'reply_count', (select count(*) from replies r where r.bottle_id = b.id),
      'last_reply_at', (select max(created_at) from replies r where r.bottle_id = b.id),
      'replies', coalesce((select jsonb_agg(_reply_json(r) order by r.created_at)
                           from (select * from replies where bottle_id = b.id order by created_at desc limit 20) r), '[]'::jsonb))
    order by b.created_at desc), '[]'::jsonb)
  from bottles b where b.owner_token = p_token
$$;

-- ---------- 함수 권한: 7개 창구만 앱에 연다 ----------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  list_bottles(uuid), get_bottle(uuid, uuid), create_bottle(uuid, text, text, text, real, real),
  add_reply(uuid, uuid, text, text), like_bottle(uuid, uuid), report_bottle(uuid, uuid), my_bottles(uuid)
  to anon, authenticated;
