# Sunset Resort C단계 — 같은 해변에서 만나기 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 주소로 들어온 사람들이 한 해변에서 서로의 캐릭터(걷기·동작·석양멍)와 30자 채팅 말풍선을 실시간으로 보게 한다.

**Architecture:** Supabase Realtime 공개 채널 `beach` 하나에 Presence(누가 있나·꾸미기·모드)와 Broadcast(`move`·`emote`·`chat`·`here`)를 쓴다. 통신은 `src/net/realtime.js`(검사·횟수 제한·재연결, 연결 어댑터 주입식)에 모으고, 화면 쪽은 `src/features/people.js`가 다른 사람 아바타를 관리한다. 테스트는 같은 브라우저의 페이지끼리 `BroadcastChannel`로 잇는 가짜 어댑터를 쓴다.

**Tech Stack:** three.js 0.170.0(벤더), `@supabase/supabase-js` **2.118.0** UMD(`dist/umd/supabase.js`, 전역 `supabase`, 218,252바이트)를 `vendor/supabase/supabase.js`로 벤더, Node `node:test`, Playwright 1.63.0.

**Spec:** `docs/superpowers/specs/2026-11-10-stage-c-design.md`

## Global Constraints

- 채널 이름 `beach`(공개 채널, `private` 옵션 쓰지 않음). 해변은 하나.
- 실시간 신원 = 앱을 열 때마다 새로 만드는 `sid`(UUID v4, `crypto.randomUUID()`). Presence key = `sid`. **`profile.token`은 실시간 메시지 어디에도 넣지 않는다.**
- Presence 상태: `{ sid, nick, look, x, z, ry, mode }`, mode ∈ `move`·`play`·`zen`.
- Broadcast: `move {sid,x,z,ry}`(5cm 이상 이동 또는 0.1rad 이상 회전 시, 500ms에 1번까지, 멈추면 마지막 1번) · `emote {sid,name}` · `chat {sid,text}`(2000ms에 1번까지) · `here {sid}`(10000ms 동안 보낸 게 없을 때).
- 상수(`src/net/realtime.js`에서 export):
  - `MOVE_INTERVAL_MS = 500`
  - `CHAT_INTERVAL_MS = 2000`
  - `HERE_IDLE_MS = 10000`
  - `STALE_MS = 30000`
  - `MAX_VISIBLE = 30`
  - `CHAT_MAX = 30`
  - `BUBBLE_MS = 5000`
  - `FLOOD_MAX = 20`(1초당)
  - `FLOOD_MUTE_MS = 3000`
  - `RECONNECT_STEPS_MS = [1000, 2000, 4000, 8000, 16000, 30000]`
- 받은 값 검사:
  - 위치는 `clampToBeach`로 당긴다.
  - 동작은 `EMOTES` 키만 받는다.
  - 닉네임은 `validateNickname` 실패 시 `'손님'`으로 표시한다.
  - look은 `normalizeLook`으로 정리한다.
  - 채팅은 trim 후 앞 30자만 쓰고, 빈 글은 버린다.
  - sid는 UUID 모양만 받는다.
  - 내 sid에서 온 것은 무시한다.
  - Presence에 없는 sid의 broadcast는 무시한다.
- 화면 문구(그대로 사용):
  - "지금 n명이 함께 있어요"
  - "연결이 끊겼어요 · 다시 연결 중"
  - "함께 보기를 켤 수 없어요"
  - 💬 버튼, 입력칸 placeholder "30자까지 말하기"
  - "보내기"
  - "보내지 못했어요"
- 사용자 글(닉네임·채팅)은 캔버스 `fillText`로만 그리고, DOM에 넣을 때는 textContent만 쓴다.
- 다른 사람 아바타는 `castShadow = false`. 동시에 그리는 수는 내 위치에서 가까운 30명.
- 코드 파일 맨 위에 "이 파일이 하는 일" 한국어 주석. 각 Task 끝에 `docs/learn/NN-…md`(24번부터) 쉬운 한국어 설명.
- 테스트 전역: `window.__SR_RT__ = 'fake'`면 가짜 어댑터, `'off'`면 실시간 끔(기존 e2e 기본값은 `'off'` — `tests/e2e/helpers.mjs`의 `seedProfile`이 넣는다).
- 커밋은 `./scripts/commit.sh "<메시지>"`.

## Review Focus

1. 앱을 내렸다가(visibility hidden) 다시 열면 상대 화면에 내 캐릭터가 **하나만** 있어야 한다(같은 sid로 다시 track) → Task 4 e2e `숨겼다 돌아와도 캐릭터는 하나`.
2. 누가 해변 밖 좌표·NaN·모르는 동작·거대한 look을 보내도 내 화면은 정상이어야 한다 → Task 2 단위 + Task 4 e2e `이상한 메시지는 무시`.
3. `profile.token`이 어떤 실시간 메시지(Presence 포함)에도 실리면 안 된다 → Task 4 e2e `기기 열쇠는 실시간으로 나가지 않는다`.
4. 채팅·닉네임에 `<img onerror>` 같은 글이 와도 DOM에 태그가 생기지 않아야 한다 → Task 5 e2e `태그가 든 채팅·닉네임`.
5. 연결이 끊긴 동안에도 혼자 걷기·석양멍은 그대로이고, 복구 뒤 캐릭터가 중복되지 않아야 한다 → Task 6 e2e `끊김 배지·재연결·중복 없음`.

---

## 파일 구조

```
vendor/supabase/supabase.js        supabase-js 2.118.0 UMD 복사본(수정 금지)
index.html                         <script src="vendor/supabase/supabase.js" defer> (모듈 스크립트보다 앞)
src/net/realtime.js                상수 · 메시지 검사(parse*) · 횟수 제한 · 폭주 무시 · createRealtime(연결 관리자) · 어댑터 2종
src/features/people.js             setupPeople: 다른 사람 아바타·보간·30초 정리·가까운 30명·인원 칩·끊김 배지·내 상태 보내기
src/scene/labels.js                makeLabel(text, kind) — 닉네임표·말풍선 캔버스 스프라이트
src/ui/chat.js                     renderChatButton / 입력칸
src/ui/hud.js                      setLinkState('online'|'offline'|'disabled'|null)
src/app.js                         hooks.emote·hooks.look 추가, setupPeople 호출
tests/unit/realtime.test.js        검사·제한·폭주·재연결 간격·연결 관리자
tests/unit/people.test.js          보간·정리·가까운 30명(순수 함수)
tests/e2e/two.mjs                  openTwo(browser) — 같은 컨텍스트의 페이지 2개(닉네임 다르게)
tests/e2e/people.spec.mjs          두 페이지 실시간
tests/e2e/chat.spec.mjs            말풍선
tests/e2e/link-state.spec.mjs      끊김·로드 실패
```

---

### Task 1: 실서버 실시간 접속 확인 + 라이브러리 벤더

**Files:**
- Create: `vendor/supabase/supabase.js`(npm `@supabase/supabase-js@2.118.0`의 `dist/umd/supabase.js` 그대로), `tests/e2e/vendor.spec.mjs`, `docs/learn/24-실시간-준비.md`
- Modify: `index.html`, `tests/e2e/helpers.mjs`(`seedProfile`에 `window.__SR_RT__ = window.__SR_RT__ ?? 'off'`), `README.md`(vendor 목록 한 줄)

**Interfaces:**
- Produces: 페이지에서 `window.supabase.createClient` 함수 사용 가능. 테스트 전역 `__SR_RT__` 기본 `'off'`.

- [ ] **Step 1: 실서버 확인(내장 브라우저, 사용자 화면 영향 없음)** — 아무 탭에서 JS로 `new WebSocket('wss://xrydrdeyaycijtxulgyw.supabase.co/realtime/v1/websocket?apikey=sb_publishable_jJ2gAAnNlaZSO6y5IamVDQ_IfzzY9N6&vsn=1.0.0')`를 연다. 열리면 `{"topic":"realtime:beach","event":"phx_join","payload":{"config":{"broadcast":{"self":false},"presence":{"key":"probe"}}},"ref":"1"}`를 보낸다. 응답 `phx_reply`의 `payload.status`를 기록한다.
  Expected: `"ok"`. 아니면 장부에 응답 전문을 적고 **멈춰서 사용자에게 묻는다**(계획이 성립하지 않음). 결과는 장부에 `Task 1: live probe …`로 남긴다.
- [ ] **Step 2: 실패 e2e** — `vendor.spec.mjs`:
  - `라이브러리가 실린다`: `typeof window.supabase?.createClient === 'function'`
  - `기존 화면은 그대로`: `gotoBeach` 후 `body[data-mode=move]`
- [ ] **Step 3: 실패 확인** — `npx playwright test tests/e2e/vendor.spec.mjs` → 첫 테스트 FAIL
- [ ] **Step 4: 구현** — 패키지에서 파일을 복사하고 SHA-256 앞 16자리 `ee3be8de192b97cb`를 확인한다. `index.html`에서 모듈 스크립트 앞에 `defer` 클래식 스크립트를 넣는다. `seedProfile` 기본값을 추가한다.
- [ ] **Step 5: 통과 + 전체 e2e** — `npx playwright test` 전부 PASS
- [ ] **Step 6: learn 문서**(실시간이 뭔지, 웹소켓, 채널·Presence·Broadcast, 사용량 계산) + Commit `chore: 실시간 라이브러리(supabase-js 2.118.0) 준비`

---

### Task 2: 메시지 검사·횟수 제한(순수 함수)

**Files:**
- Create: `src/net/realtime.js`(이 Task에서는 상수와 순수 함수만), `tests/unit/realtime.test.js`, `docs/learn/25-믿지-않고-검사하기.md`

**Interfaces:**
- Consumes: `clampToBeach`(scene/world.js), `EMOTES`(character/animations.js), `validateNickname`(state/nickname.js), `normalizeLook`(state/profile.js)
- Produces:
  - Global Constraints의 상수 전부
  - `isSid(v): boolean` — UUID 정규식 `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`
  - `parsePresence(raw): {sid,nick,look,x,z,ry,mode}|null`
    - nick이 유효하지 않으면 `'손님'`
    - mode가 move·play·zen이 아니면 `'move'`
    - ry가 유한하지 않으면 0
    - x·z가 유한하지 않으면 null
  - `parseMove(raw): {sid,x,z,ry}|null` — 범위 밖 x·z는 당기고, x·z·ry 중 하나라도 유한하지 않으면 null
  - `parseEmote(raw): {sid,name}|null`
  - `parseChat(raw): {sid,text}|null`
  - `createLimiter(intervalMs): { ready(now): boolean, mark(now): void }`
  - `createFloodGuard({ max = FLOOD_MAX, windowMs = 1000, muteMs = FLOOD_MUTE_MS } = {}): { allow(sid, now): boolean }`

- [ ] **Step 1: 실패 테스트** (`tests/unit/realtime.test.js`)
  - `parseMove: x 99 → 30으로, z -99 → -12로(BOUNDS)`
  - `parseMove: NaN·문자열·Infinity → null`
  - `parseMove: sid가 'abc'면 null`
  - `parseEmote: 'cheers' 통과, 'explode' null, '__proto__' null`
  - `parseChat: '  안녕  ' → '안녕', 31자 → 앞 30자, '   ' → null, 숫자 123 → null`
  - `parsePresence: nick '<b>x</b>' → '손님', look {hat:'crown', shirt:99} → normalizeLook 결과, mode 'fly' → 'move', 메타에 token 필드가 있어도 결과에는 없다`
  - `createLimiter(500): t=0 ready → mark → t=499 false → t=500 true`
  - `createFloodGuard: 같은 sid 20번 allow, 21번째 false, 3000ms 뒤 다시 true, 다른 sid는 영향 없음`
- [ ] **Step 2: 실패 확인** — `npm run test:unit` → realtime 테스트 FAIL(모듈 없음)
- [ ] **Step 3: 구현** — 위 시그니처대로 작성한다. `parsePresence`는 허용 필드만 새 객체로 복사한다.
- [ ] **Step 4: 통과** — `npm run test:unit` 전부 PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: 실시간 메시지 검사와 보내기 횟수 제한`

---

### Task 3: 연결 관리자와 어댑터(진짜·가짜)

**Files:**
- Modify: `src/net/realtime.js`
- Test: `tests/unit/realtime.test.js`(추가)
- Create: `docs/learn/26-연결-관리자.md`

**Interfaces:**
- 어댑터 계약(둘 다 같은 모양):
  - 생성: `adapter = makeXxxTransport(opts)`
  - 연결: `adapter.connect({ sid, onPresence(list: raw[]), onLeave(sid), onBroadcast(event, payload), onStatus('online'|'offline') }) → void`
  - 그 밖의 메서드: `adapter.track(state) → Promise<void>`, `adapter.send(event, payload) → Promise<boolean>`, `adapter.disconnect() → void`
- `supabaseTransport({ url, key })` — 전역 `supabase` 사용.
  - 클라이언트: `supabase.createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })`
  - 채널: `client.channel('beach', { config: { presence: { key: sid }, broadcast: { self: false } } })`
  - Presence: `'sync'` 이벤트 때 `presenceState()`의 각 key 첫 메타를 `onPresence`로 넘긴다. `'leave'` 이벤트의 `key`는 `onLeave`로 넘긴다.
  - Broadcast: `on('broadcast', { event: '*' }, …)`로 받는다.
  - 상태: subscribe 콜백이 `SUBSCRIBED`면 online, 그 밖은 offline.
  - 보내기 결과: `send`는 `ch.send({ type: 'broadcast', event, payload })`의 결과가 `'ok'`인지로 판단한다.
  - 끊기: `disconnect`는 `client.removeChannel(ch)`.
  - **Step 0에서 벤더 파일로 위 메서드 이름을 확인한다.**
- `fakeTransport(name = 'sr-fake-rt')` — `BroadcastChannel`을 쓴다.
  - 보내는 글: `{t:'track', sid, state}`, `{t:'leave', sid}`, `{t:'bc', event, payload}`
  - 새 sid의 track을 처음 받으면 내 state를 한 번 다시 track한다(늦게 온 사람이 기존 사람을 알게).
  - 보낸 모든 글을 `window.__rtSent`에 기록한다.
  - 테스트 조작: `window.__rtFake = { failNext(n), drop(), silence() }`
    - `drop()`: offline 알리고 연결 끊김
    - `silence()`: leave 없이 보내기·받기 중단
- `createRealtime({ sid, transport, now = () => Date.now(), setTimer = setTimeout, clearTimer = clearTimeout })`이 돌려주는 것:
  - 상태 값: `status`('idle'|'connecting'|'online'|'offline'|'disabled')
  - 시작·끝: `start()`, `stop()`
  - 내 상태: `setState(state)` — 저장하고, online이면 track
  - 보내기:
    - `sendMove({x,z,ry}) → boolean` — 리미터 통과 시만
    - `sendEmote(name)`
    - `sendChat(text) → Promise<'ok'|'limited'|'failed'>`
    - `tickIdle()` — 마지막 보낸 지 HERE_IDLE_MS면 `here`
  - 받기 구독: `on(event, fn)` — event ∈ presence·leave·move·emote·chat·here·status
  - 받은 메시지는 parse* + 폭주 무시 + 내 sid 무시를 거쳐 넘긴다.
  - 재연결: offline이 되면 `RECONNECT_STEPS_MS` 차례로(끝은 30000 반복) `transport.connect`를 다시 부르고, online이 되면 저장된 state를 다시 track한다.

- [ ] **Step 0: 벤더 파일에서 API 확인** — `grep -o "presenceState\|removeChannel\|SUBSCRIBED\|channel(" vendor/supabase/supabase.js | sort | uniq -c`. Expected: 네 개 모두 1회 이상. 다르면 장부에 Ruling을 남기고 실제 이름을 쓴다.
- [ ] **Step 1: 실패 테스트**(메모리 어댑터 객체로)
  - `start → connect 호출, onStatus('online') 후 status online, 저장된 state가 track됨`
  - `offline 후 1000·2000·4000ms 간격으로 재연결 시도, online 되면 간격 처음부터`
  - `sendMove는 500ms 안에 두 번 부르면 두 번째 false`
  - `sendChat: 2초 안 두 번째 'limited', 어댑터 send false면 'failed'`
  - `받은 move: 내 sid는 무시, presence에 없는 sid는 무시, 있는 sid는 parse 결과로 on('move') 호출`
  - `tickIdle: 마지막 보낸 지 10000ms면 here 1번, 그 전엔 0번`
  - `track·send로 나간 모든 payload의 JSON에 profile token 문자열이 없다`(state에 token을 넣지 않는다는 계약 — setState가 허용 필드만 보냄)
- [ ] **Step 2: 실패 확인** — `npm run test:unit` → 새 테스트 FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과** — `npm run test:unit` 전부 PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: 실시간 연결 관리자와 진짜·가짜 어댑터`

---

### Task 4: 다른 사람 캐릭터(people)

**Files:**
- Create: `src/features/people.js`, `src/scene/labels.js`, `tests/unit/people.test.js`, `tests/e2e/two.mjs`, `tests/e2e/people.spec.mjs`, `docs/learn/27-같은-해변.md`
- Modify: `src/app.js`(`app.hooks.emote = []`·`app.hooks.look = []`; `onEmote`·`onTake(drink)`에서 `hooks.emote` 호출; 꾸미기 `onChange`에서 `hooks.look` 호출; `setupPeople(app, …)` 호출), `src/ui/hud.js`(`setLinkState`), `styles.css`

**Interfaces:**
- Consumes:
  - Task 3 `createRealtime`, `supabaseTransport`, `fakeTransport`
  - Task 2 상수
  - `buildAvatar(look)`, `new AnimationController(parts, group)`, `effects.spawnHearts`·`spawnBall`
  - `app.quality`
  - `hud.setPeople(n|null)`
- Produces:
  - `makeLabel(text: string, kind: 'nick'|'bubble'): THREE.Sprite`(`.userData.dispose()` 포함)
  - `setupPeople(app, { scene, player, profile, effects, getHud, world, now })` → `{ realtime, people: Map<sid, Person>, count(): number, visibleCount(): number, prune(now): void }`
  - `app.people`가 위 반환값이다.
  - `app.realtime`는 realtime이다.
  - `app.sid`
  - 순수 함수(people.js export):
    - `stepToward(cur, target, dt): {x,z}` — 0.5초에 약 90% 접근: 계수 `1 - Math.exp(-dt * 4.6)`
    - `staleSids(people, now, ms = STALE_MS): string[]`
    - `nearestSids(people, me, n = MAX_VISIBLE): Set<string>`
- 동작:
  - 연결 고르기: `__SR_RT__ === 'off'`면 연결하지 않는다. `'fake'`면 fakeTransport를 쓴다. 그 밖에는 `window.supabase` 있으면 supabaseTransport, 없으면 status `disabled`.
  - 연결 시점과 상태: enter 훅에서 start한다. 프레임마다 내 위치를 sendMove하고, 멈추면 마지막 위치 1번 보내고, `tickIdle`를 부른다.
  - Presence 상태 갱신: mode·look이 바뀌면 setState를 다시 부른다. 석양멍이면 mode `zen`, 그 밖은 현재 mode(`messages`·`photo`면 `move`).
  - 화면 숨김: hidden·`pagehide`이면 `stop()`(leave). visible이면 `start()`로 같은 sid로 다시 들어간다.
  - 저품질: `app.quality === 'low'`면 다른 사람 동작의 하트·공 이펙트는 생략한다(동작 자체는 재생).
  - 상대가 석양멍(mode zen)이면 받은 x·z 위치에서 `anim.play('lie')`를 재생한다.
  - 1초마다 `prune(now)`로 30초 지난 사람을 지운다. leave를 받으면 바로 지운다.
  - 인원 칩: `hud.setPeople(online ? people.size + 1 : null)`
- `setLinkState(state)`: offline이면 `#chip-link` "연결이 끊겼어요 · 다시 연결 중", disabled면 "함께 보기를 켤 수 없어요", 그 밖은 숨긴다.

- [ ] **Step 1: 실패 단위 테스트** (`tests/unit/people.test.js`)
  - `stepToward: dt 0.5에 남은 거리 10% 이하`
  - `staleSids: lastSeen 29999ms 전은 남고 30000ms 전은 나온다`
  - `nearestSids: 35명 중 가까운 30명`
- [ ] **Step 2: 실패 e2e** (`people.spec.mjs`; `two.mjs`의 `openTwo(browser)`는 한 컨텍스트에 `__SR_RT__='fake'`·`__SR_NOW__` 설정 후 페이지 A(닉네임 '하나') 진입 → localStorage를 B 프로필(닉네임 '둘', token 다름)로 바꾸고 페이지 B 진입 → `{a, b}`)
  - `서로 보인다`: 양쪽 `__app.people.count() === 1`, 인원 칩 "지금 2명이 함께 있어요"
  - `A가 걸으면 B 화면의 A가 따라온다`: A에서 ArrowUp 1초 → B의 A 캐릭터 z가 1 이상 줄어듦(2초 안)
  - `건배가 보인다`: A 놀기→건배 → B의 A 아바타 `anim.state === 'cheers'`
  - `닉네임표·꾸미기`: B에서 A 사람의 `nick === '하나'`, `look`이 A 프로필 look과 같음
  - `숨겼다 돌아와도 캐릭터는 하나`(Review Focus 1): A에서 hidden → B count 0 → A visible → B count 1
  - `이상한 메시지는 무시`(Review Focus 2): A에서 `__rtFake`로 `move {x:NaN}`·`{x:999}`·`emote 'explode'` 직접 보냄 → B의 A 위치는 유한하고 |x| ≤ 30, 오류 없음(`pageerror` 0)
  - `기기 열쇠는 실시간으로 나가지 않는다`(Review Focus 3): 위 동작 뒤 A의 `window.__rtSent` JSON에 A token 없음
  - `소식이 끊기면 30초 뒤 사라진다`: A `__rtFake.silence()` → B에서 `__app.people.prune(Date.now() + 30001)` → count 0
- [ ] **Step 3: 실패 확인** — 단위·e2e FAIL
- [ ] **Step 4: 구현** — app.js가 300줄을 넘으면 `onTake`·꾸미기 연결 같은 짧은 묶음을 빼서 줄일 수 있으면 함께 정리(넘으면 Ruling).
- [ ] **Step 5: 통과 + 전체 e2e** — `npm run test:unit && npx playwright test` 전부 PASS
- [ ] **Step 6: learn 문서 + Commit** `feat: 같은 해변의 다른 사람 캐릭터`

---

### Task 5: 채팅 말풍선

**Files:**
- Create: `src/ui/chat.js`, `tests/e2e/chat.spec.mjs`, `docs/learn/28-말풍선.md`
- Modify: `src/features/people.js`(말풍선 표시·5초 제거), `src/app.js`(chat 버튼 연결은 people.js 안에서 하면 수정 없음), `styles.css`

**Interfaces:**
- Consumes: Task 3 `sendChat`, `on('chat')`; Task 4 `makeLabel(text,'bubble')`
- Produces:
  - `renderChat(root, { onSend(text): Promise<'ok'|'limited'|'failed'> }) → { remove() }`
    - 💬 버튼 `#chat-btn`(이동하기·놀기 모드에서만 보임)
    - 입력칸 `#chat-input`(maxlength 30, placeholder "30자까지 말하기")
    - 보내기 `#chat-send`("보내기"), 오류 `#chat-error`
    - Enter로 보낸다(한글 조합 중 제외).
    - 'ok'면 입력칸을 비운다. 'limited'면 아무 문구 없이 그대로 둔다. 'failed'면 "보내지 못했어요"를 띄우고 글을 남긴다.
  - `app.people.bubbleOf(sid|'me'): string|null`(테스트용)
- 말풍선은 내 캐릭터와 상대 캐릭터 머리 위(닉네임표 위)에 BUBBLE_MS 동안 뜬다. 새 말이 오면 이전 것을 바꾼다.

- [ ] **Step 1: 실패 e2e**
  - `말하면 양쪽 머리 위에`: A `#chat-btn` → '안녕' → 보내기 → A `bubbleOf('me') === '안녕'`, B `bubbleOf(A sid) === '안녕'`
  - `5초 뒤 사라짐`: 위 뒤 5.5초 → 둘 다 null
  - `태그가 든 채팅·닉네임`(Review Focus 4): A 닉네임 `'<b>x</b>'`(유효하지 않아 '손님'), 채팅 `'<img src=x onerror="window.__pwned=1">'` → B `bubbleOf`는 그 문자열 그대로, B `window.__pwned` undefined, `document.querySelectorAll('img').length`가 전과 같다
  - `2초에 한 번`: 연달아 두 번 보내면 B가 받은 chat은 1번, 두 번째 글은 입력칸에 남음
  - `보내지 못했어요`: A에서 `__rtFake.drop()` 후 보내기 → `#chat-error` "보내지 못했어요", 입력칸 글 유지
  - `30자 제한`: `#chat-input` maxlength 30
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 + 전체 e2e**
- [ ] **Step 5: learn 문서 + Commit** `feat: 머리 위 채팅 말풍선`

---

### Task 6: 끊김·복구·로드 실패

**Files:**
- Create: `tests/e2e/link-state.spec.mjs`, `docs/learn/29-끊겨도-괜찮게.md`
- Modify: 필요 시 `src/features/people.js`, `src/net/realtime.js`

**Interfaces:**
- Consumes: Task 3 재연결, Task 4 `setLinkState`, `__rtFake.drop()`·`failNext(n)`

- [ ] **Step 1: 실패 e2e**
  - `끊김 배지·재연결·중복 없음`(Review Focus 5):
    1. A `__rtFake.failNext(1)` 후 `drop()`
    2. A `#chip-link` "연결이 끊겼어요 · 다시 연결 중"
    3. 끊긴 동안 A ArrowUp 1초 → A 위치 이동(혼자 걷기 정상)
    4. 3초 안에 배지 사라짐
    5. B count 1(중복 없음), A count 1
  - `라이브러리 로드 실패에도 앱이 열린다`: `__SR_RT__` 없이(실제 경로) `vendor/supabase/supabase.js` 요청을 `route.abort()` → `body[data-mode=move]`, `#chip-link` "함께 보기를 켤 수 없어요", 걷기 정상
  - `실서버로 나가지 않는다`: 위 테스트 동안 `*.supabase.co/realtime/**` 요청 0개(가짜 Supabase 라우트로 확인)
- [ ] **Step 2: 실패 확인** · **Step 3: 구현(부족한 부분만)** · **Step 4: 통과 + 전체 e2e**
- [ ] **Step 5: learn 문서 + Commit** `feat: 실시간 끊김 표시와 자동 재연결`

---

### Task 7: 배포·실서버 확인

**Files:**
- Modify: `docs/deploy.md`(C단계: Realtime 설정 "Allow public access" 확인 위치, 사용량 보는 곳 Usage › Realtime), `README.md`(C단계 기능), `docs/checklist-phone.md`(두 폰 확인 항목)

- [ ] **Step 1: 전체 테스트** — `npm run test:sql && npm run test:unit && npx playwright test` 전부 PASS
- [ ] **Step 2: 맥 동기화** — 새 이름 tgz → `Future/sunset-resort`에 풀고 추적 파일 결합 해시를 컨테이너와 대조 → 사용자 Commit·Push
- [ ] **Step 3: 실서버 확인(내장 브라우저)**
  - 배포 주소를 탭 두 개로 연다. 같은 프로필이라 sid만 다르다. 닉네임이 같아도 된다.
  - 서로 보이는지, 인원 "지금 2명", 걷기 따라옴, 건배, 채팅 말풍선, 한 탭 숨김 시 사라짐을 확인한다.
  - 콘솔 오류 0개를 확인한다.
  - Supabase Usage › Realtime에서 메시지 수를 확인한다.
  - 결과는 장부에 기록한다.
- [ ] **Step 4: 사용자 폰 확인 요청**(체크리스트) + Commit `docs: C단계 배포 안내`
