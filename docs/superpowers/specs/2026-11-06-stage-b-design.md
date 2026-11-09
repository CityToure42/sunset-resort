# Sunset Resort B단계 — 모두의 바다 (설계 문서)

작성일: 2026-11-06 · 상태: 사용자 검토 대기 · 선행: `2026-11-04-sunset-resort-design.md`(A단계 완료·배포됨)

## 1. 목표와 범위

- 유리병 편지를 서버(Supabase)에 저장해 **모든 사용자의 바다에 함께 떠다니게** 한다(공개형 — 원본 Snow Village의 "모두의 트리"와 같은 방식).
- 바다의 병을 탭하면 편지 카드가 열리고 ♥ 좋아요·답글·신고를 할 수 있다.
- 공유 링크 `주소#b=<id>`로 열면 그 병 앞으로 가서 카드가 열린다.
- 용도: 친구들끼리 노는 규모. 회원가입 없음(A단계의 폰별 토큰 유지).
- 범위 밖: 실시간 동시접속·같은 해변에서 만나기(C단계), 금칙어 필터, 하루 띄우기 제한, 관리자 페이지, 로그인.

## 2. 화면 동작

- **모두의 바다**: 해변 진입 시 서버에서 숨겨지지 않은 최근 병 200개를 받아 띄운다. 해변에 있는 동안 60초마다, 앱이 다시 보이게 될 때(visibilitychange) 다시 받는다. 내 병에는 작은 별 표시.
- **병 열어보기**: 바다의 병을 탭(이동하기·놀기 모드, 바다 보기 화면 포함) → `#bottle-card` 시트: 병 모양, 닉네임, 내용, 날짜, ♥ 좋아요 수(한 폰 한 번), 답글 목록, 답글 쓰기(1~50자), "신고".
- **편지 띄우기**: A단계 흐름 그대로(쓰기 → 위치 고르기 → 띄우기 → 링크), 저장만 서버로. 실패하면 쓴 내용을 유지하고 "다시 띄우기" 버튼(한 번 누를 때 한 번만 요청).
- **공유 링크**: `#b=<id>`로 진입(처음 온 사람은 닉네임부터) → 그 병의 x에 맞춘 바다 보기 카메라 + 카드 열기. 없거나 숨겨진 병이면 토스트 "이 편지는 바다에서 사라졌어요" 후 해변.
- **메시지 보기**: 내가 띄운 병 목록(좋아요 수, 답글 수와 답글 내용, 숨겨진 병은 "숨겨짐" 표시). 마지막으로 메시지 보기를 연 뒤 새 답글이 있으면 탭에 빨간 점(`profile.lastSeenReplyAt` 저장).
- **신고**: 신고하면 내 바다에서 즉시 사라지고(폰에 신고한 id 기억), 서로 다른 폰 3개가 신고하면 모두의 바다에서 숨김. 숨김 해제는 관리자가 Supabase 화면에서 신고 수를 0으로.
- **A단계 폰 저장 병 옮기기**: B단계 첫 실행 때 `profile.bottles`를 서버로 하나씩 올리고, 성공한 것만 폰 목록에서 지운다. 실패한 것은 다음 실행 때 다시.
- **오프라인·서버 무응답**: 앱은 계속 동작, 토스트 "바다 소식을 불러오지 못했어요", 60초 뒤 재시도.

## 3. 서버 (Supabase, 무료 플랜, 서울 리전)

- 프로젝트: `sunset-resort` (조직 CityToure42, Free, Northeast Asia (Seoul) ap-northeast-2), 2026-11-06 생성.
- 주소 `https://xrydrdeyaycijtxulgyw.supabase.co`, 공개 키(publishable) `sb_publishable_jJ2gAAnNlaZSO6y5IamVDQ_IfzzY9N6` — Supabase가 공개해도 안전하다고 명시한 값. secret 키·DB 비밀번호는 코드·문서 어디에도 두지 않는다.
- 생성 시 보안 옵션: Data API 켬, "Automatically expose new tables" 끔.

### 3.1 표
- `bottles`: `id uuid pk default gen_random_uuid()`, `owner_token uuid not null`, `nickname text` (trim 후 2~10자, 한글·영문·숫자·공백), `shape text` (round·tall·square·jar·heart·star), `message text` (trim 후 1~50자), `x real` (−18~18), `z real` (−24~−12), `created_at timestamptz default now()`, `likes int default 0`, `reports int default 0`.
- `replies`: `id uuid pk`, `bottle_id uuid → bottles on delete cascade`, `author_token uuid`, `nickname`(규칙 동일), `message`(1~50자), `created_at`.
- `likes`: `(bottle_id → bottles cascade, device_token uuid)` 기본키.
- `reports`: `(bottle_id → bottles cascade, device_token uuid)` 기본키.
- 숨김 기준: `reports >= 3`.

### 3.2 접근 규칙
- 네 표 모두 RLS 켜고 정책 없음 → `anon`·`authenticated`는 표를 직접 읽거나 쓸 수 없다.
- 아래 7개 함수만 `security definer`, `set search_path = public`, `anon`에 execute 허용. 반환값에 토큰 컬럼은 절대 포함하지 않는다.
  1. `list_bottles(p_token uuid)` → 숨겨지지 않은 최근 200개 `(id, nickname, shape, message, x, z, created_at, likes, is_mine)`
  2. `get_bottle(p_id uuid, p_token uuid)` → 병 1개(숨겨진 병은 주인에게만) + `liked_by_me` + `replies[]`(최신 50개, 오래된 순)
  3. `create_bottle(p_token, p_nickname, p_shape, p_message, p_x, p_z)` → 새 병(1과 같은 모양)
  4. `add_reply(p_token, p_bottle_id, p_nickname, p_message)` → 답글 `(id, nickname, message, created_at)`. 숨겨진 병에는 불가
  5. `like_bottle(p_token, p_bottle_id)` → 현재 좋아요 수(같은 폰 두 번째부터 증가 없음)
  6. `report_bottle(p_token, p_bottle_id)` → `hidden boolean`(같은 폰 중복 무시, 자기 병 신고 무시)
  7. `my_bottles(p_token)` → 내 병 전체(숨겨진 것 포함) + `reply_count`, `last_reply_at`, `hidden`
- 앱에 들어가는 것은 Supabase URL과 **anon(공개) 키**뿐. service_role 키는 어디에도 넣지 않는다.
- 관리: 관리자가 Supabase 웹 화면에서 행 삭제(답글·좋아요·신고 연쇄 삭제), 신고 수 수정.

### 3.3 깨어 있게 하기
- `.github/workflows/keepalive.yml`: 매일 1회(KST 오전) `list_bottles`를 호출(anon 키는 공개값이라 워크플로 파일에 직접 둔다).

### 3.4 알려진 한계(수용)
- 가짜 토큰으로 좋아요 부풀리기·신고로 남의 병 숨기기가 가능하다. 친구 규모라 수용, 문제 시 로그인 도입.

## 4. 앱 코드

- 새 파일
  - `src/net/config.js` — `SUPABASE_URL`, `SUPABASE_ANON_KEY`
  - `src/net/api.js` — `createApi({ url, key, fetchImpl = fetch, timeoutMs = 8000 })` → 7개 함수. `POST {url}/rest/v1/rpc/<fn>`, 헤더 `apikey: <publishable 키>`·`Content-Type: application/json` (publishable 키는 JWT가 아니므로 `Authorization` 헤더에 넣지 않는다). 실패 시 `ApiError{ kind: 'offline'|'timeout'|'server'|'invalid' }`
  - `src/state/remoteBottles.js` — `RemoteBottleStore({ api, token })`: `list()`, `add(b)`, `get(id)`, `like(id)`, `report(id)`, `reply(id, nickname, message)`, `mine()` (모두 async), `migrateLocal(profileBottles, save)`
  - `src/ui/bottleCard.js` — 편지 카드 시트
  - `src/features/bottles.js` — 편지 관련 연결 코드(쓰기·위치 고르기·바다 새로고침·카드·메시지 보기·링크) — `src/app.js`에서 분리
- 바뀌는 파일: `src/app.js`(분리 후 조립만), `src/scene/bottles3d.js`(내 병 별 표시, 탭한 병 찾기 `pickBottle(ndc, camera)`), `src/ui/panels.js`(메시지 보기에 좋아요·답글·숨겨짐), `src/ui/hud.js`(메시지 탭 빨간 점), `src/state/profile.js`(`reportedIds`, `lastSeenReplyAt`), `styles.css`.
- 공식 supabase-js 라이브러리는 넣지 않는다(실시간이 필요한 C단계에서 도입).
- 사용자 글은 전부 `textContent`로만 표시.

## 5. 오류 처리

| 상황 | 동작 |
|---|---|
| 목록 불러오기 실패 | 기존 바다 유지(처음이면 빈 바다), 토스트 "바다 소식을 불러오지 못했어요", 60초 뒤 재시도 |
| 띄우기 실패 | 내용 유지, "다시 띄우기", 진행 중 버튼 비활성 |
| 좋아요·신고·답글 실패 | 화면 변경 없음, 토스트 "잠시 후 다시 시도해 주세요" |
| 없는/숨겨진 병 링크 | "이 편지는 바다에서 사라졌어요" |
| 입력 규칙 위반(서버 거부) | 해당 칸 아래 오류 문구(A단계 문구 재사용) |

## 6. 테스트

1. **SQL 테스트**: 로컬 PostgreSQL 16에 `anon`·`authenticated` 역할과 `pgcrypto`를 만든 뒤 `supabase/migrations/001_b_stage.sql` 실행, `tests/sql/*.sql`을 `anon` 권한으로 실행해 검사 — 표 직접 접근 거부, 토큰 비노출, 길이·모양·위치 거부, 좋아요 중복 무시, 3명 신고 숨김·같은 폰 중복 무시·자기 병 신고 무시, 숨긴 병의 목록 제외와 `my_bottles` 포함, 삭제 연쇄.
2. **단위 테스트**: `api.js`(요청 모양, 시간 초과, 오류 분류), `remoteBottles.js`(옮기기 부분 실패 재시도).
3. **브라우저 테스트**: `page.route`로 가짜 Supabase(메모리)를 끼워 전체 흐름 + A단계 기존 테스트 전부.
4. **실서버 확인**: 클라우드 작업 환경과 맥 셸에서는 supabase.co 접속이 막혀 있으므로, 내장 브라우저로 배포된 앱(또는 github.io 페이지의 fetch)에서 병 1개 띄우기·읽기를 확인하고 관리 화면에서 삭제한다. SQL은 Supabase 웹 SQL 편집기에서 실행한다.

## 7. 완료 기준

- 세민님 폰에서 띄운 병을 다른 폰(친구)의 바다에서 탭해 읽고, ♥와 답글을 남기면 세민님 메시지 보기에 빨간 점과 함께 보인다.
- `#b=` 링크를 받은 친구가 그 병 앞에서 카드를 연다.
- 신고 3번이면 모두의 바다에서 사라진다.
