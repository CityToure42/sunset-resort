# Sunset Resort B단계 (모두의 바다) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 유리병 편지를 Supabase에 저장해 모든 사용자의 바다에 띄우고, 병을 탭해 읽고 ♥·답글·신고하며, `#b=` 링크로 특정 병을 열 수 있게 한다.

**Architecture:** 서버는 표 4개를 RLS로 완전히 잠그고 `security definer` RPC 7개만 `anon`에 연다(모두 `jsonb` 반환). 앱은 라이브러리 없이 `fetch`로 RPC를 부르는 `api.js` → `RemoteBottleStore` → `src/features/bottles.js`(app.js에서 분리) 순으로 쌓는다. 테스트는 로컬 PostgreSQL 16(SQL), Node 단위, Playwright + 메모리 가짜 Supabase(`page.route`) 세 겹.

**Tech Stack:** PostgreSQL 16(로컬 `/usr/lib/postgresql/16/bin`), Supabase(무료, 서울), 기존 three.js 0.170.0, Node 22 `node:test`, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-06-stage-b-design.md` (A단계 스펙 `2026-11-04-sunset-resort-design.md`의 규칙은 그대로 유효)

## Global Constraints

- Supabase URL `https://xrydrdeyaycijtxulgyw.supabase.co`, publishable 키 `sb_publishable_jJ2gAAnNlaZSO6y5IamVDQ_IfzzY9N6`. 요청 헤더는 `apikey`와 `Content-Type: application/json`만(Authorization 없음). secret 키·DB 비밀번호는 어디에도 넣지 않는다.
- RPC 7개 이름과 인자(모두 `p_` 접두): `list_bottles(p_token)`, `get_bottle(p_id, p_token)`, `create_bottle(p_token, p_nickname, p_shape, p_message, p_x, p_z)`, `add_reply(p_token, p_bottle_id, p_nickname, p_message)`, `like_bottle(p_token, p_bottle_id)`, `report_bottle(p_token, p_bottle_id)`, `my_bottles(p_token)`. 모두 `jsonb` 반환, 어떤 응답에도 토큰 컬럼 없음.
- 숨김 기준 `reports >= 3`. 목록 상한 200개. 답글 표시 최신 50개. 닉네임 trim 후 2~10자(한글·영문·숫자·공백), 메시지·답글 trim 후 1~50자, 모양 6종, x −18~18, z −24~−12 (A단계와 동일 — `src/state/bottles.js`·`nickname.js` 재사용).
- 요청 시간 초과 8000ms. 바다 새로고침 60초 + `visibilitychange`(visible).
- 문구(스펙 그대로): "바다 소식을 불러오지 못했어요", "이 편지는 바다에서 사라졌어요", "잠시 후 다시 시도해 주세요", "다시 띄우기", "숨겨짐", "신고".
- 사용자 글(닉네임·메시지·답글)은 `textContent`/`.value`로만 DOM에 넣는다.
- 모든 소스 첫 줄 `// 이 파일이 하는 일: …` 한국어 주석. 각 Task 끝에 `docs/learn/NN-*.md`(B단계는 17번부터) 갱신.
- 커밋은 `scripts/commit.sh "<메시지>"`. 동기화는 매번 **새 파일 이름**의 tgz로.
- 클라우드·맥 셸 모두 supabase.co 접속 불가 → 실서버 작업은 내장 브라우저로.

## Review Focus

1. "여기에 띄우기"를 빠르게 두 번 누르거나 실패 후 "다시 띄우기"를 연타해도 병은 하나만 생겨야 한다 → Task 6 `중복 띄우기 방지` e2e.
2. 서버가 401/403/500을 돌려주면(키 오류·잠든 서버) 앱은 계속 동작하고 안내만 떠야 한다 → Task 2 단위 테스트(`server` 분류) + Task 6 `서버 오류에도 해변은 정상` e2e.
3. 처음 온 친구가 `#b=` 링크로 들어와 닉네임부터 정해도, 해변에 들어가는 순간 그 병 카드가 열려야 한다 → Task 8 e2e.
4. 내가 신고한 병은 새로고침·재실행 뒤에도 내 바다에 다시 나타나면 안 된다 → Task 7 e2e(`reportedIds` 저장).
5. 다른 사람이 닉네임·편지·답글에 `<img src=x onerror=…>`를 넣어도 글자로만 보여야 한다 → Task 7 e2e(카드)·Task 9 e2e(메시지 보기).

---

## 파일 구조

```
supabase/migrations/001_b_stage.sql   표·제약·RLS·RPC 7개·권한
tests/sql/run.sh                      임시 PostgreSQL 클러스터 → 역할 준비 → 마이그레이션 → 테스트 → 정리
tests/sql/b_stage_test.sql            anon 권한으로 규칙 검사 (실패 시 RAISE EXCEPTION)
src/net/config.js                     SUPABASE_URL, SUPABASE_KEY
src/net/api.js                        createApi, ApiError
src/state/remoteBottles.js            RemoteBottleStore (서버 저장소 + A단계 병 옮기기)
src/features/bottles.js               편지 기능 연결(쓰기·위치·바다·새로고침·카드·메시지·링크) — app.js에서 분리
src/ui/bottleCard.js                  편지 카드 시트
tests/e2e/fake-supabase.mjs           page.route 기반 메모리 가짜 Supabase (SQL과 같은 규칙)
.github/workflows/keepalive.yml       매일 list_bottles 호출
```

---

### Task 1: 서버 SQL과 SQL 테스트

**Files:**
- Create: `supabase/migrations/001_b_stage.sql`, `tests/sql/run.sh`, `tests/sql/b_stage_test.sql`, `docs/learn/17-서버-규칙.md`
- Modify: `package.json` (`"test:sql": "bash tests/sql/run.sh"`)

**Interfaces:**
- Produces (JSON 모양, 이후 모든 Task가 사용): 병 `{id, nickname, shape, message, x, z, created_at, likes, is_mine}`; `get_bottle` → `null` 또는 `{bottle: <병>, liked_by_me: bool, replies: [{id, nickname, message, created_at}]}`(숨겨진 병은 주인에게만, 답글은 최신 50개를 오래된 순); `create_bottle` → `<병>`; `add_reply` → `{id, nickname, message, created_at}` 또는 숨겨진/없는 병이면 예외; `like_bottle` → `{likes}`; `report_bottle` → `{hidden}`; `my_bottles` → `[<병> + {hidden, reply_count, last_reply_at, replies: 최신 20개}]` 최신순.

- [ ] **Step 1: `tests/sql/run.sh` 작성** — `initdb`로 `$TMPDIR/pg-sr`에 클러스터, 포트 55432로 `pg_ctl start`, `create role anon nologin; create role authenticated nologin;`, `001_b_stage.sql` 실행, `psql -v ON_ERROR_STOP=1 -f tests/sql/b_stage_test.sql`, 종료 시 `trap`으로 `pg_ctl stop` + 폴더 삭제. 성공하면 마지막 줄 `SQL TESTS PASSED`.
- [ ] **Step 2: 실패하는 테스트 작성** — `b_stage_test.sql`: `set role anon;` 상태에서 각 검사는 `do $$ … $$` 블록, 실패 시 `raise exception '<검사 이름>'`. 검사 목록:
  - `anon_cannot_select_tables`: `select * from bottles`가 권한 오류
  - `anon_cannot_insert_directly`: `insert into bottles …`가 권한 오류
  - `create_and_list`: 토큰 A로 `create_bottle('A','세민','round','안녕',0,-18)` → `list_bottles(A)`에 1개, `is_mine=true`; `list_bottles(B)`의 같은 병 `is_mine=false`
  - `no_token_in_responses`: 모든 RPC 응답 텍스트에 `token` 문자열 없음
  - `reject_invalid`: 메시지 51자, 공백만, 닉네임 1자, 모양 `'cup'`, x=19, z=0 각각 예외
  - `like_once_per_device`: 같은 토큰 2번 → likes 1, 다른 토큰 → 2
  - `report_hides_after_three_devices`: 토큰 B 신고 2번 + C 1번 → hidden false; D → true; `list_bottles`에서 빠지고 `my_bottles(A)`에는 `hidden=true`로 남음; `get_bottle(id, B)` null, `get_bottle(id, A)` not null
  - `owner_report_ignored`: 주인 토큰 신고는 세지 않음
  - `reply_rules`: 답글 추가 후 `get_bottle`에 포함, 숨겨진 병에 `add_reply`는 예외
  - `list_limit_200`: 205개 생성 후 `list_bottles` 길이 200, 최신순
  - `cascade_delete`: `reset role`(관리자) 후 병 삭제 시 replies·likes·reports 0
- [ ] **Step 3: 실패 확인** — Run: `npm run test:sql` Expected: 마이그레이션 파일 없음 오류로 FAIL
- [ ] **Step 4: `001_b_stage.sql` 구현** — 표 4개(스펙 3.1, `check` 제약에 규칙), 인덱스 `bottles(created_at desc)`, 네 표 `enable row level security` + `revoke all … from anon, authenticated, public`, RPC 7개 `language plpgsql security definer set search_path = public`, `revoke execute on all functions … from public; grant execute on function <7개> to anon, authenticated`. 닉네임 정규식 `'^[가-힣A-Za-z0-9 ]{2,10}$'`(trim 후). 중복 좋아요/신고는 `insert … on conflict do nothing` 후 `get diagnostics`로 증가 여부 판단. 파일은 여러 번 실행해도 안전하게(`create … if not exists`, `create or replace function`).
- [ ] **Step 5: 통과 확인** — Run: `npm run test:sql` Expected: `SQL TESTS PASSED`
- [ ] **Step 6: `docs/learn/17-서버-규칙.md` + Commit** `feat: B단계 서버 SQL(표·RLS·RPC)과 SQL 테스트`

---

### Task 2: 설정과 API 클라이언트

**Files:**
- Create: `src/net/config.js`, `src/net/api.js`, `tests/unit/api.test.js`, `docs/learn/18-서버와-대화.md`

**Interfaces:**
- Produces: `SUPABASE_URL`, `SUPABASE_KEY`(Global Constraints 값). `class ApiError extends Error { kind: 'offline'|'timeout'|'server'|'invalid'; status?: number }`. `createApi({ url, key, fetchImpl = globalThis.fetch, timeoutMs = 8000 })` → `{ listBottles(token), getBottle(id, token), createBottle({token, nickname, shape, message, x, z}), addReply({token, bottleId, nickname, message}), likeBottle(token, bottleId), reportBottle(token, bottleId), myBottles(token) }` — 각각 `POST {url}/rest/v1/rpc/<fn>` 본문 `{p_…}`, 파싱한 JSON 반환. 분류: fetch 거부 → `offline`, 시간 초과(AbortController) → `timeout`, HTTP 400·422(제약 위반, Postgres 오류코드 `23514`/`P0001` 포함) → `invalid`, 그 외 비정상 → `server`.

- [ ] **Step 1: 실패 테스트** (가짜 fetch 주입)
  - `요청 모양`: `listBottles('t')` → URL `…/rest/v1/rpc/list_bottles`, method POST, 헤더 `apikey`=키·`Content-Type`, `Authorization` 없음, 본문 `{"p_token":"t"}`
  - `createBottle 인자 이름`: 본문 키가 `p_token,p_nickname,p_shape,p_message,p_x,p_z`
  - `fetch가 throw → offline`, `8초 넘으면 timeout`(timeoutMs 50으로 테스트), `400 → invalid`, `401/500 → server`(status 보존), `200 null → null 반환`
- [ ] **Step 2: 실패 확인** — `npm run test:unit` FAIL(모듈 없음)
- [ ] **Step 3: 구현** · **Step 4: 통과 확인** — `npm run test:unit` 전부 PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: Supabase 설정과 API 클라이언트`

---

### Task 3: RemoteBottleStore와 A단계 병 옮기기

**Files:**
- Create: `src/state/remoteBottles.js`, `tests/unit/remoteBottles.test.js`
- Modify: `src/state/profile.js` (`reportedIds: string[]`, `lastSeenReplyAt: string` 추가 — `defaultProfile`·`hydrateProfile`에서 배열/문자열 아니면 기본값), `tests/unit/profile.test.js`

**Interfaces:**
- Consumes: Task 2 `createApi`, `ApiError`; A단계 `validateBottle`.
- Produces: `class RemoteBottleStore { constructor({ api, token }); list(): Promise<Bottle[]>; add({shape, message, x, z, nickname}): Promise<Bottle>; get(id): Promise<{bottle, likedByMe, replies} | null>; like(id): Promise<number>; report(id): Promise<boolean>; reply(id, nickname, message): Promise<Reply>; mine(): Promise<MyBottle[]>; migrateLocal(profileBottles, save): Promise<{moved, failed}> }`. `Bottle = {id, nickname, shape, message, x, z, createdAt, likes, isMine}`(snake→camel 변환), `Reply = {id, nickname, message, createdAt}`, `MyBottle = Bottle & {hidden, replyCount, lastReplyAt, replies: Reply[]}`. `add`는 먼저 `validateBottle`로 검사(실패 시 `ApiError('invalid')`). `migrateLocal`은 성공한 병만 배열에서 제거(배열 직접 수정)하고 `save()`.

- [ ] **Step 1: 실패 테스트** — 가짜 api 객체로: 변환(`created_at`→`createdAt`, `is_mine`→`isMine`), `add` 잘못된 입력은 api 호출 없이 invalid, `get` null 통과, `migrateLocal`: 3개 중 2번째 실패 → 결과 `{moved:2, failed:1}`, 배열에 실패한 1개만 남음, save 호출됨, 다시 실행하면 그 1개만 시도. profile: `hydrateProfile({reportedIds:'x'})` → `[]`, `lastSeenReplyAt` 기본 `''`.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과** (`npm run test:unit`)
- [ ] **Step 5: Commit** `feat: RemoteBottleStore와 A단계 병 옮기기`

---

### Task 4: 가짜 Supabase(e2e용)

**Files:**
- Create: `tests/e2e/fake-supabase.mjs`, `tests/e2e/fake-supabase.spec.mjs`
- Modify: `tests/e2e/helpers.mjs` (`gotoBeach(page, extra, { fake } = {})`가 기본으로 가짜 Supabase를 설치하고 반환)

**Interfaces:**
- Produces: `async installFakeSupabase(page, { bottles = [], failWith = null } = {}) → { state, setFail(status|null), addBottle(partial) }` — `page.route(SUPABASE_URL + '/rest/v1/rpc/**')`로 7개 RPC를 Task 1과 같은 규칙(모양·길이·위치 검사 → 400, 좋아요/신고 중복, 3기기 신고 숨김, 주인 신고 무시, 200개 상한, 토큰 비노출)으로 메모리에서 처리. `failWith`가 숫자면 모든 RPC가 그 상태 코드로 응답. `state = { bottles, replies, likes, reports, calls: [{fn, body}] }`. `gotoBeach(page, extra, opts)`는 이제 `fake` 핸들을 반환한다(기존 호출부는 반환값을 쓰지 않으므로 그대로 호환). `opts.fake`로 seed 병·`failWith`를 넘긴다.

- [ ] **Step 1: 실패 테스트** — 빈 페이지에서 `fetch`로 가짜를 직접 불러 Task 1 검사 중 5개(create_and_list, like_once, report_hides, reject_invalid, no_token)를 브라우저 쪽에서 재현.
- [ ] **Step 2~4** — `npx playwright test tests/e2e/fake-supabase.spec.mjs` PASS, 기존 e2e 전체 PASS(앱은 아직 서버를 안 부르므로 영향 없음)
- [ ] **Step 5: Commit** `test: e2e용 메모리 가짜 Supabase`

---

### Task 5: 편지 기능을 `src/features/bottles.js`로 분리 (동작 변화 없음)

**Files:**
- Create: `src/features/bottles.js`, `docs/learn/19-기능-나누기.md`
- Modify: `src/app.js` (유리병 편지·메시지 보기 구역 제거, 대신 `setupBottles(app, ctx)` 호출)

**Interfaces:**
- Produces: `setupBottles(app, { scene, camera, player, cameraRig, els, profile, saveProfile, hud: () => hud, setMode, showToast }) → { store, field, refresh(): Promise<void> }` — 지금 app.js의 `store`·`bottleField`·바다 보기·편지 쓰기·위치 고르기·링크 시트·메시지 보기·`beforeMode` 정리 코드를 그대로 옮긴다. `app.bottleStore`, `app.bottleField`, `app.onGoSea`, `app.onWriteBottle`는 그대로 노출.

- [ ] **Step 1: 기준선** — `npx playwright test --timeout 25000` 전부 PASS 기록(56개)
- [ ] **Step 2: 옮기기** — 코드 이동만, 로직 변경 금지
- [ ] **Step 3: 확인** — 같은 명령으로 56개 PASS, `wc -l src/app.js`가 300 이하
- [ ] **Step 4: learn 문서 + Commit** `refactor: 편지 기능을 features/bottles.js로 분리`

---

### Task 6: 서버 저장으로 전환 — 모두의 바다, 새로고침, 옮기기, 오류

**Files:**
- Modify: `src/features/bottles.js`, `src/scene/bottles3d.js` (`set(bottles)`에서 `isMine`이면 작은 별 스프라이트를 병 위에 표시, getter `starCount`), `src/app.js`(store 생성: `new RemoteBottleStore({ api: createApi({url: SUPABASE_URL, key: SUPABASE_KEY}), token: profile.token })`), `src/ui/panels.js`(링크 시트 문구에서 "다음 단계에서 열려요" 제거), `tests/e2e/bottles.spec.mjs`(가짜 서버 기준으로 수정)
- Create: `tests/e2e/shared-sea.spec.mjs`, `docs/learn/20-모두의-바다.md`

**Interfaces:**
- Consumes: Task 3 store, Task 4 `fake`.
- Produces: `refresh()` — `store.list()`로 받은 병에서 `profile.reportedIds`를 뺀 뒤 `field.set()`; 실패 시 기존 바다 유지 + 토스트 "바다 소식을 불러오지 못했어요"(같은 실패가 연속이면 토스트는 한 번만). 해변 진입 시 1회 + `setInterval(60000)` + `visibilitychange`(visible). 진입 시 `profile.bottles`가 있으면 `store.migrateLocal(profile.bottles, saveProfile)` 후 refresh. `app.refreshSea = refresh`(테스트용).
- 띄우기: `onPlace`는 진행 중 플래그로 중복 차단, `await store.add(...)`; 성공 시 A단계와 같은 토스트·링크 시트 + refresh; 실패 시 위치 고르기 화면 유지, 오류 칸에 이유(invalid는 A단계 문구, 그 외 "잠시 후 다시 시도해 주세요"), 버튼 문구 "다시 띄우기".

- [ ] **Step 1: 실패 e2e** (`shared-sea.spec.mjs`)
  - `남의 병이 내 바다에 뜬다`: fake에 남의 병 2개 → `bottleField.count === 2`
  - `내 병에는 별`: fake에 내 토큰 병 1 + 남 1 → 별 스프라이트 1개(`__app.bottleField.starCount === 1`)
  - `띄우면 서버에 저장된다`: 쓰기 플로우 → `fake.state.bottles.length === 1`, 응답의 id가 링크에 들어감
  - `중복 띄우기 방지`(Review Focus 1): "여기에 띄우기"를 `dblclick` → 병 1개; 실패 후 "다시 띄우기" 연타도 1개
  - `서버 오류에도 해변은 정상`(Review Focus 2): `failWith: 500` → 토스트 "바다 소식을 불러오지 못했어요", `data-mode=move`, 걷기 가능; 띄우기 실패 시 오류 문구 "잠시 후 다시 시도해 주세요", 버튼 "다시 띄우기", `setFail(null)` 후 누르면 성공
  - `60초 새로고침`: `fake.addBottle(...)` 후 `__app.refreshSea()` 호출 → count 증가(타이머 자체는 `page.clock`으로 61초 진행해 확인)
  - `A단계 병 옮기기`: seed 프로필 `bottles` 2개 → 진입 후 `fake.state.bottles.length === 2`, `profile.bottles.length === 0`
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과** — `shared-sea.spec.mjs` + 전체 e2e PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: 모두의 바다 — 서버 저장·새로고침·옮기기·오류 처리`

---

### Task 7: 병 탭 → 편지 카드 (♥·답글·신고)

**Files:**
- Create: `src/ui/bottleCard.js`, `tests/e2e/card.spec.mjs`, `docs/learn/21-편지-카드.md`
- Modify: `src/scene/bottles3d.js` (`pickBottle(ndc: THREE.Vector2, camera): string|null` — 병 그룹들에 레이캐스트, 맞은 병 id), `src/features/bottles.js`, `styles.css`

**Interfaces:**
- Consumes: Task 3 `get/like/report/reply`.
- Produces: `bottleField.screenPos(id, camera): {x, y} | null`(병의 화면 좌표, 테스트·디버그용). `renderBottleCard(root, { data: {bottle, likedByMe, replies}, myNickname, onLike, onReply(text), onReport, onClose }) → { setLikes(n, liked), addReply(reply), showError(text), remove() }` — `#bottle-card` 시트: 모양 이름, `.nick`, `.msg`, 날짜, `#card-like`("♥ n", 눌렀으면 `aria-pressed=true`), `.replies .reply`(닉네임+내용), `#card-reply-input`(maxlength 50) + `#card-reply-send`("보내기"), `#card-report`("신고"). 모든 사용자 글은 textContent.
- 탭 판정: 이동하기·놀기 모드와 바다 보기에서 `#joystick-layer`의 짧은 탭(이동 < 8px, 300ms 이내) → `pickBottle` → 있으면 `store.get(id)` 후 카드. 탭은 조이스틱(왼쪽)·카메라(오른쪽) 어디서 시작하든 인정, 드래그면 무시.
- 신고: 성공 시 `profile.reportedIds`에 추가·저장, 카드 닫고 바다에서 즉시 제거, 토스트 "신고했어요. 내 바다에서 숨겼어요".

- [ ] **Step 1: 실패 e2e**
  - `병을 탭하면 카드가 열린다`: fake 병 1개(바다 보기 화면 중앙 근처 좌표) → 바다 보기 → 병 화면 좌표 탭(`__app.bottleField.screenPos(id)`로 계산) → `#bottle-card .msg` 텍스트 일치
  - `좋아요는 한 번`: `#card-like` 두 번 → "♥ 1", `aria-pressed=true`
  - `답글`: 입력 후 보내기 → 목록 맨 아래에 추가, 51자 이상은 입력 불가(maxlength)
  - `신고하면 사라지고 재실행 뒤에도 안 보인다`(Review Focus 4): 신고 → count 감소 → reload → 여전히 없음(`fake`에는 남아 있음)
  - `남의 글은 글자로만`(Review Focus 5): 닉네임 `'<b>x</b>'`, 메시지 `'<img src=x onerror="window.__pwned=1">'`, 답글도 같은 문자열 → 카드에 그 문자열이 그대로 보이고 `window.__pwned`는 undefined, `#bottle-card img` 0개
  - `드래그는 탭이 아니다`: 병 위에서 40px 드래그 → 카드 없음
  - `서버 실패`: like 시 `setFail(500)` → 숫자 그대로, 토스트 "잠시 후 다시 시도해 주세요"
- [ ] **Step 2~4** · **Step 5: learn 문서 + Commit** `feat: 병을 탭해 읽는 편지 카드(좋아요·답글·신고)`

---

### Task 8: 공유 링크 `#b=` 열기

**Files:**
- Create: `tests/e2e/link.spec.mjs`
- Modify: `src/features/bottles.js` (해변 진입 훅에서 `location.hash`가 `#b=<uuid>`면 처리, 처리 후 `history.replaceState`로 해시 제거)

**Interfaces:**
- Consumes: Task 7 카드, A단계 바다 보기 카메라.
- Produces: `openSharedBottle(id)` — `store.get(id)`; 있으면 그 병 x로 바다 보기 카메라 이동 + 카드; null이면 토스트 "이 편지는 바다에서 사라졌어요"; 네트워크 실패면 "바다 소식을 불러오지 못했어요". 앱이 이미 열려 있을 때 `hashchange`도 처리.

- [ ] **Step 1: 실패 e2e** — `기존 사용자가 링크로 들어오면 카드가 열린다`(cameraRig.mode `fixed`, 카드 메시지 일치, 주소에서 `#b=` 사라짐); `처음 온 친구`(Review Focus 3): 프로필 없이 `/#b=<id>` → 진입 화면 → 닉네임 입력·입장 → 카드 열림; `없는 병` → 토스트 문구; `hashchange`.
- [ ] **Step 2~4** · **Step 5: Commit** `feat: 공유 링크로 병 열기`

---

### Task 9: 메시지 보기 — 좋아요·답글·숨겨짐·빨간 점

**Files:**
- Create: `tests/e2e/messages.spec.mjs`, `docs/learn/22-메시지-보기.md`
- Modify: `src/ui/panels.js` (`renderMessagesPanel(root, { bottles: MyBottle[], loading, error, onClose })`), `src/ui/hud.js` (`setUnread(on)` → 메시지 탭에 `.dot`), `src/features/bottles.js`

**Interfaces:**
- Consumes: Task 3 `mine()`, `profile.lastSeenReplyAt`. (`my_bottles`가 답글 최신 20개를 함께 돌려주는 것은 스펙 3.2-7에 대한 추가 — 메시지 보기에서 답글 내용을 보여 주기 위함.)
- Produces: 메시지 보기 진입 시 "불러오는 중…" → `store.mine()` 결과로 목록(모양·`.msg`·날짜·"♥ n · 답글 n", 숨겨진 병은 `.hidden-tag` "숨겨짐", 답글은 `.reply` 목록) → `profile.lastSeenReplyAt = 가장 최근 lastReplyAt` 저장, `hud.setUnread(false)`. 실패 시 `.empty`에 "바다 소식을 불러오지 못했어요". 빨간 점: 새로고침마다(Task 6 refresh에 묶어) `mine()`의 최대 `lastReplyAt` > `profile.lastSeenReplyAt`이면 `setUnread(true)`.

- [ ] **Step 1: 실패 e2e** — 내 병 2개(하나 숨김, 하나 답글 2개) → 목록 2, 숨겨짐 태그 1, 답글 2개 표시; 새 답글이 생기면 `refreshSea()` 후 탭에 `.dot`, 메시지 보기 열면 `.dot` 사라지고 reload 후에도 없음; 답글 내용에 `<img onerror>` → 글자로만(Review Focus 5); `failWith 500` → 실패 문구.
- [ ] **Step 2~4** · **Step 5: learn 문서 + Commit** `feat: 메시지 보기에 좋아요·답글·숨김·새 답글 표시`

---

### Task 10: 깨우기 작업·실서버 적용·배포

**Files:**
- Create: `.github/workflows/keepalive.yml`, `docs/learn/23-실서버-연결.md`
- Modify: `docs/deploy.md`(B단계 서버 관리: 병 삭제·신고 수 0으로 되돌리기 방법), `README.md`(B단계 기능)

- [ ] **Step 1: keepalive** — `on: schedule: cron "17 0 * * *"`(UTC 00:17 = KST 09:17) + `workflow_dispatch`; 한 단계: `curl -fsS -X POST "$URL/rest/v1/rpc/list_bottles" -H "apikey: $KEY" -H "Content-Type: application/json" -d '{"p_token":"00000000-0000-4000-8000-000000000000"}'`(URL·KEY는 Global Constraints 값을 파일에 직접).
- [ ] **Step 2: 전체 테스트** — `npm run test:sql && npm run test:unit && npx playwright test --timeout 25000` 전부 PASS.
- [ ] **Step 3: 실서버 SQL 적용** — 사용자 확인 후 내장 브라우저로 Supabase SQL 편집기(`/project/xrydrdeyaycijtxulgyw/sql/new`)에 `001_b_stage.sql` 붙여 넣고 실행. 성공 메시지 확인.
- [ ] **Step 4: 동기화·배포** — 새 이름 tgz로 맥에 반영 → 사용자가 GitHub Desktop Commit·Push.
- [ ] **Step 5: 실서버 확인** — 10분 뒤 내장 브라우저로 배포 주소에서: 병 1개 띄우기 → 다른 토큰(시크릿 탭 대신 `localStorage` 비운 새 탭)에서 그 병이 보이는지 → 카드·좋아요 → Supabase Table editor에서 그 병 삭제. 결과를 장부에 기록.
- [ ] **Step 6: learn 문서 + Commit** `chore: 서버 깨우기 작업, 배포 문서`
