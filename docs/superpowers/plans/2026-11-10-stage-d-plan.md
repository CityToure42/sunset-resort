# Sunset Resort D단계 — 리조트 놀거리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 조개 모아 바에서 칵테일 사기, 표정 6종, 선베드 6세트(빈 자리 석양멍), 튜브 대여·앞바다 튜브, 항상 열린 버블풀을 만들고, 모두 친구 화면에도 보이게 한다.

**Architecture:** 화면 없는 규칙(`state/wallet.js`·`scene/places.js`)을 먼저 만들고, 3D(아바타 표정·튜브·잔, 조개, 수영장)와 기능 묶음(`features/resort.js`)이 그 규칙을 쓴다. 실시간은 C단계 Presence에 `tube`·`drink` 두 칸만 더하고, 물속·뜬 자세는 받은 위치로 각자 계산한다.

**Tech Stack:** 기존 그대로(three.js 0.170.0, supabase-js 2.118.0 벤더, node:test, Playwright 1.63.0). 서버(DB) 변경 없음.

**Spec:** `docs/superpowers/specs/2026-11-10-stage-d-design.md`

## Global Constraints

- 지갑:
  - 시작 조개 3(새 사용자·기존 사용자 모두), 상한 9999, 정수
  - 칵테일 가격 🐚3, 한 잔 3모금
  - 조개 줍기 반경 0.8m, 줍고 60초 뒤 다른 자리에 다시
  - 석양멍 60초마다 +1
- 메뉴(이름·색 순서 = `COCKTAIL_COLORS` 인덱스 0~3): 선셋 오렌지, 블루 라군, 핑크 플라밍고, 모히또.
- 표정 `FACES = ['smile','round','grin','wink','heart','sleepy']`(라벨: 기본 미소·땡그란 눈·활짝 웃음·윙크·하트 눈·졸린 눈).
- 튜브 `TUBES = ['donut','flamingo','watermelon']`(라벨: 도넛·플라밍고·수박).
- 장소(`src/scene/places.js` export):
  - `SHORE_Z = -9.5`, `SHALLOW_MIN_Z = -12`, `TUBE_MIN_Z = -22`, `SEA_X = 28`
  - `POOL = { x: 9, z: 14, w: 8, d: 5 }`(x 5~13, z 11.5~16.5)
  - `TUBE_RACK = { x: -12, z: -7 }`
  - `SUNBEDS`(6개, ry 모두 `Math.PI - 0.45`): (5.3, 2.0), (1.8, 2.0), (−1.7, 2.6), (8.7, 1.0), (3.5, 6.5), (7.5, 6.5)
- 속도 배수: 바다(튜브) 0.7, 수영장 0.6. 수영장 몸 높이 −0.9. 튜브 뜬 높이 −0.55 ± 0.06 흔들림.
- 빈 선베드: 석양멍 중인 친구 위치에서 1.5m 안에 없는 선베드.
- 문구(그대로):
  - 버튼: "칵테일 사기", "튜브 빌리기", "튜브 반납", "마시기"
  - 배지·토스트: "🐚 n", "+1 🐚"
  - 안내: "조개가 3개 필요해요", "들고 있는 잔은 사라져요", "튜브를 빌리면 더 나갈 수 있어요"
- Presence 상태에 `tube`(TUBES 또는 null), `drink`(0~3 또는 null) 추가. `look.face`는 look 안에 둔다.
- 받는 쪽 위치 검사는 `clampFor(p, { tube: true })`(가장 넓은 범위)로 한다.
- 사용자 글·이름은 지금처럼 textContent/캔버스로만 넣는다.
- 각 Task 끝에 `docs/learn/NN-…md`(30번부터)를 쓰고, `./scripts/commit.sh "<msg>"`로 커밋한다.
- 전체 e2e는 10분을 넘으므로 백그라운드로 실행해 결과를 확인한다.

## Review Focus

1. 기존 사용자(옛 프로필: `cocktails` 칸·`look.cocktail` 있음, `shells` 없음)가 열면 조개 3·빈손으로 정상 진입해야 한다 → Task 1 단위 `옛 프로필 정리` + Task 4 e2e `옛 프로필로 들어와도 조개 3·빈손`.
2. "칵테일 사기"를 연타해도 조개가 두 번 줄거나 음수가 되면 안 된다 → Task 1 단위 `조개 부족이면 거절·음수 없음` + Task 4 e2e `메뉴 연타해도 한 번만`.
3. 튜브를 탄 채 바다에서 석양멍을 누르면 선베드로 옮겨 누워야 하고, 바다에서는 반납 버튼이 없어야 한다 → Task 5 e2e `바다에서 석양멍`.
4. 친구가 앞바다(z −20)에 떠 있으면 내 화면에서도 그 자리에 떠 있어야 한다(해안 z −12로 당겨지면 안 됨) → Task 7 e2e `친구 튜브는 앞바다에`.
5. 수영장 가장자리를 들락날락해도 몸 높이가 튀지 않고 부드럽게 바뀌어야 한다 → Task 6 e2e `수영장 들락날락 부드럽게`.

---

## 파일 구조

```
src/state/wallet.js        START_SHELLS·PRICE·SIPS·MENU, earn/buy/sip (순수)
src/state/profile.js       FACES·TUBES, shells·drink·tube·look.face 정리
src/scene/places.js        장소 상수, placeOf, clampFor, isFreeSpot, chooseSunbed (순수)
src/scene/world.js         clamp가 튜브 유무(setReach)를 따른다
src/character/player.js    step이 api.speed를 쓴다(속도 배수 적용 가능)
src/character/animations.js baseY(쉬는 높이)·swim(팔 젓기) 추가
src/character/avatar.js    표정 6종(parts.faces), setDrink, setTube
src/scene/props.js         선베드 6세트(points.sunbeds), 튜브 거치대, 수영장 자리(pool.js 호출)
src/scene/shells3d.js      조개 12개 놓기·줍기·다시 놓기
src/scene/pool.js          수영장 메쉬 + 비눗방울·거품
src/features/resort.js     조개·바·마시기·튜브 대여·장소 자세·석양멍 자리 (app.js에서 setupResort 한 줄)
src/ui/resortPanels.js     메뉴판(#bar-menu), 튜브 고르기(#tube-picker)
src/ui/entry.js            꾸미기: 칵테일 줄 → 표정 줄
src/ui/hud.js              #badge-shells("🐚 n"), #btn-tube
src/ui/panels.js           놀기 바 '마시기' 버튼(setDrinkVisible)
src/net/realtime.js        STATE_KEYS·parsePresence(tube·drink)·넓힌 위치 범위
src/features/people.js     친구의 표정·잔·튜브·장소 자세
```

---

### Task 1: 지갑 규칙과 프로필 칸

**Files:**
- Create: `src/state/wallet.js`, `tests/unit/wallet.test.js`, `docs/learn/30-조개-지갑.md`
- Modify: `src/state/profile.js`, `tests/unit/profile.test.js`

**Interfaces:**
- Produces:
  - `wallet.js` 상수: `START_SHELLS = 3`, `MAX_SHELLS = 9999`, `PRICE = 3`, `SIPS = 3`, `ZEN_SHELL_SECONDS = 60`
  - `MENU = [{ id: 0, name: '선셋 오렌지' }, { id: 1, name: '블루 라군' }, { id: 2, name: '핑크 플라밍고' }, { id: 3, name: '모히또' }]`
  - `earn(profile, n = 1): number` — 새 조개 수(상한 9999)
  - `buy(profile, id): { ok: true } | { ok: false, reason: 'shells' | 'menu' }` — 성공 시 shells −3, `drink = { cocktail: id, sips: 3 }`
  - `sip(profile): number | null` — 남은 모금. 0이 되면 `drink = null`을 하고 0을 돌려준다. 잔이 없으면 null.
  - `profile.js`: `FACES`, `TUBES` export, `defaultProfile()`에 `shells: 3, drink: null, tube: null`, `look.face: 'smile'`
  - `hydrateProfile`: shells가 0~9999 정수가 아니거나 없으면 3. drink는 `{cocktail 0~3 정수, sips 1~3 정수}` 아니면 null. tube는 TUBES 아니면 null. `normalizeLook`: face가 FACES 아니면 'smile'.

- [ ] **Step 1: 실패 테스트**
  - `wallet.test.js`:
    - `시작 조개 3`
    - `earn: +1, 9999 상한`
    - `buy(3): 조개 3 → 0, drink {cocktail:3, sips:3}`
    - `조개 부족이면 거절·음수 없음`: 조개 2에서 buy → `{ok:false, reason:'shells'}`, shells 2 그대로. 두 번 연속 buy(6→0)는 두 번 다 ok, 세 번째는 거절(0 유지)
    - `buy(9)·buy(-1)·buy('1') → reason 'menu'`
    - `sip 3번이면 빈손`: 2,1,0 순서로 돌려주고 drink null, 다음 sip은 null
    - `잔을 들고 또 사면 새 잔으로`: cocktail 0 sips 1 → buy(2) → {cocktail:2, sips:3}
  - `profile.test.js` 추가 `옛 프로필 정리`:
    - `hydrateProfile({ nickname:'세민', token:<uuid>, look:{hat:'straw',glasses:true,shirt:1,cocktail:2}, cocktails:{date:'2026-11-05',count:4} })` → shells 3, drink null, tube null, look.face 'smile'
    - 이상값 `{shells:-5, drink:{cocktail:7,sips:2}, tube:'boat', look:{face:'evil'}}` → 3, null, null, 'smile'
    - `{shells: 12.5}` → 3
- [ ] **Step 2: 실패 확인** — `npm run test:unit` → 새 테스트 FAIL
- [ ] **Step 3: 구현**
- [ ] **Step 4: 통과** — `npm run test:unit` 전부 PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: 조개 지갑 규칙과 프로필 칸`

---

### Task 2: 장소 규칙 · 이동 범위 · 속도

**Files:**
- Create: `src/scene/places.js`, `tests/unit/places.test.js`, `docs/learn/31-장소-판정.md`
- Modify: `src/scene/world.js`(`clamp`가 `clampFor` 사용, `setReach({ tube })`), `src/character/player.js`(이동에 `api.speed` 사용), `tests/unit/world.test.js`·`tests/unit/player.test.js`(필요 시)

**Interfaces:**
- Consumes: 기존 `resolveColliders`, `BOUNDS`
- Produces(`places.js`):
  - 상수: Global Constraints의 장소 상수
  - `placeOf(x, z): 'pool' | 'sand' | 'shallow' | 'sea'`
    - POOL 사각형 안이면 pool
    - z ≥ −9.5면 sand
    - −12 ≤ z < −9.5면 shallow
    - z < −12면 sea
  - `clampFor({x, z}, { tube = false } = {}): {x, z}`
    - z는 40 이하, 하한은 튜브 없으면 −12, 있으면 −22
    - x는 −30~30, z < −12인 곳에서는 −28~28
  - `isFreeSpot(x, z, colliders, margin = 0.6): boolean` — 수영장 밖이고 모든 충돌 원에서 r+margin 밖
  - `chooseSunbed(sunbeds, me: {x,z}, taken: {x,z}[], radius = 1.5): sunbed` — 빈 선베드 중 가장 가까운 것, 다 차면 그냥 가장 가까운 것
- `world.setReach({ tube })` 뒤 `world.clamp(p, r)`이 그 범위를 따른다. `world.clampToBeach`는 그대로 둔다(B단계 병 코드가 쓴다).
- `player.speed`를 바꾸면 다음 step부터 그 속도로 움직인다.

- [ ] **Step 1: 실패 테스트** (`places.test.js`)
  - `placeOf 경계`:
    - (9,14) pool
    - (4.9,14) sand
    - (0,−9.5) sand
    - (0,−9.6) shallow
    - (0,−12) shallow
    - (0,−12.1) sea
  - `clampFor`:
    - 튜브 없이 (0,−20) → z −12
    - 튜브 있으면 (0,−20) 그대로, (0,−30) → −22
    - (35,−15, tube) → x 28
    - (35, 5) → x 30
  - `chooseSunbed`:
    - me (5,2), taken [(5.3,2.0)] → (1.8, 2.0)(빈 자리 중 가장 가까움, 거리 3.2)
    - 6개 다 taken → (5.3,2.0)
  - `SUNBEDS 배치`:
    - 서로 3.0m 이상
    - 야자수 5그루(props의 좌표)와 2.0m 이상
    - 바 (−5.5,4)와 3.5m 이상
    - POOL 밖
  - `isFreeSpot`: 수영장 안 false, 충돌 원 안 false
  - `player.speed`(player.test): speed 1.25로 바꾸고 1초 → 1.25 이동
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과** — `npm run test:unit` 전부 PASS + 기존 e2e `move.spec`·`bottles.spec` PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: 장소 판정과 튜브 이동 범위`

---

### Task 3: 아바타 — 표정·잔·튜브·물속 자세 + 꾸미기 표정

**Files:**
- Create: `tests/e2e/face.spec.mjs`, `docs/learn/32-표정.md`
- Modify: `src/character/avatar.js`, `src/character/animations.js`, `src/ui/entry.js`, `tests/unit/avatar.test.js`, `tests/unit/animations.test.js`

**Interfaces:**
- Consumes: Task 1 `FACES`, `TUBES`
- Produces:
  - `avatar.parts.faces`: `{ smile, round, grin, wink, heart, sleepy }` — 각 Group(눈+입). 눈은 `name: 'eyes'` 하위 그룹으로 둔다.
  - `setLook(look)`: face 하나만 visible. glasses가 true면 모든 face의 eyes를 숨긴다. look.cocktail은 무시한다.
  - `avatar.setDrink(index | null)`: null이면 `parts.cocktail.visible = false`, 숫자면 그 색으로 보인다. 처음 상태는 null(빈손).
  - `avatar.setTube(type | null)`: `parts.tube`(허리 높이 0.62 링, 3종 색·모양: 도넛 분홍 링+스프링클, 플라밍고 분홍 링+목·머리, 수박 초록 링+빨간 안쪽) 보이기/숨기기
  - `AnimationController`:
    - `baseY`(기본 0): 쉬는 자세의 group y 목표에 더해진다
    - `swim`(기본 false): true면 walk 때 다리 대신 팔을 크게 젓는다
- 꾸미기: `renderLookControls`의 칵테일 줄을 "표정" 줄 `[data-group="face"]`로 바꾼다. 버튼은 `button[data-face="<id>"]`이고 라벨은 표정 이름이다.

- [ ] **Step 1: 실패 테스트**
  - `avatar.test.js`:
    - PART_NAMES에서 'cocktail'은 유지하고 'faces'·'tube'를 추가한다.
    - `기본은 빈손·미소`: cocktail.visible false, faces.smile.visible true, 나머지 false
    - `setLook face round + glasses false → round 보이고 eyes 보임; glasses true → round의 eyes 숨김, 입은 보임`
    - `setDrink(3) → cocktail 보이고 액체 색 COCKTAIL_COLORS[3]; setDrink(null) → 숨김`
    - `setTube('flamingo') → tube 보임, setTube(null) → 숨김`
    - 기존 `setLook({cocktail:2})` 테스트는 `setDrink(2)` 테스트로 바꾼다.
  - `animations.test.js`:
    - `baseY -0.9면 idle 1초 뒤 group.position.y ≈ -0.9(±0.05)`
    - `swim true + walk면 팔 rotation.x가 크게(|x| > 0.5) 바뀌고 다리는 0 근처`
  - `face.spec.mjs`:
    - 꾸미기 열기 → `[data-face="heart"]` 클릭 → `__app.avatar.parts.faces.heart.visible === true`
    - 새로고침 후에도 heart
    - 꾸미기에 `[data-cocktail]` 버튼 0개
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과** — 단위 + `face.spec`·`entry-hud.spec` PASS
- [ ] **Step 5: learn 문서 + Commit** `feat: 표정 6종과 빈손·튜브·물속 자세 준비`

---

### Task 4: 조개 줍기 · 바에서 사기 · 마시기

**Files:**
- Create: `src/scene/shells3d.js`, `src/features/resort.js`, `src/ui/resortPanels.js`, `tests/e2e/bar.spec.mjs`, `docs/learn/33-조개와-바.md`
- Modify:
  - `src/app.js`: CocktailCounter와 onTake 제거 → `setupResort(app, …)`. 석양멍 매초 타이머는 그대로 둔다.
  - `src/ui/hud.js`: `#badge-cocktail` → `#badge-shells`, `setShells(n)`, `#btn-take` 문구 "칵테일 사기"
  - `src/ui/panels.js`: 놀기 바에 `{ emote: 'drink', label: '마시기' }`, 반환값에 `setDrinkVisible(bool)`, `app.playBar`로 노출
  - `styles.css`
  - `tests/e2e/daily.spec.mjs`: 칵테일 5잔 테스트 2개 → 이 Task의 테스트로 대체하고 석양 무드 테스트만 남긴다
  - `tests/e2e/entry-hud.spec.mjs`: 배지 기대값 "🐚 3"
- 날짜 유틸(`state/daily.js`)은 무드에서 계속 쓰므로 둔다. `CocktailCounter`는 미사용이 되면 지운다.

**Interfaces:**
- Consumes:
  - Task 1 wallet
  - Task 2 `isFreeSpot`, `SHORE_Z`
  - Task 3 `avatar.setDrink`
  - 기존 `showToast`, `anim.play('drink')`, `app.hooks.emote`
- Produces:
  - `createShellField(scene, { count = 12, rng = Math.random, isFree, now = () => Date.now() })` → `{ update(t), pickNear(pos, r = 0.8): number, positions(): {x,z}[], respawnDue(): void }`
    - 줍힌 조개는 60000ms 뒤 `isFree`를 만족하는 무작위 자리(x −26~26, z −8~30)에 다시 생긴다.
  - `setupResort(app, { scene, world, player, avatar, anim, profile, saveProfile, getHud, setMode, showToast, effects })` → `app.resort = { shells: field, openBar(), buy(id), drink() }`
  - `#bar-menu` 시트:
    - 메뉴 4개 `button[data-menu="0..3"]`, 각 줄에 이름과 "🐚3"
    - 들고 있으면 `.note` "들고 있는 잔은 사라져요"
    - 부족하면 그 버튼 아래 `.error` "조개가 3개 필요해요"
    - 산 뒤 시트 닫힘, 토스트 "<이름> 한 잔 받았어요"
  - 석양멍 보상: 1초 타이머가 `app.mode === 'zen'`일 때 누적하고, 60초마다 `earn` + 토스트 "+1 🐚" + 배지 갱신.
  - 상태가 바뀌면(사기·다 마심) `app.hooks.gear`(새 훅 배열)를 부른다. Task 7이 여기에 실시간 setState를 건다.

- [ ] **Step 1: 실패 e2e** (`bar.spec.mjs`, `gotoBeach` 사용)
  - `처음엔 빈손·🐚 3`: `#badge-shells` "🐚 3", `__app.avatar.parts.cocktail.visible === false`
  - `조개를 주우면 +1`: `__app.resort.shells.positions()[0]`으로 플레이어를 순간이동(`__app.player.teleport`) → 다음 프레임 뒤 배지 "🐚 4", 토스트 "+1 🐚"
  - `바에서 모히또 사기 → 마시기 3번 → 빈손`:
    - 바 앞으로 순간이동 → "칵테일 사기" → `[data-menu="3"]` → 🐚 0, 잔 보임(액체 색 모히또)
    - 놀기 → "마시기" 3번(각 1.6초 간격) → 잔 숨김, 마시기 버튼 숨김
  - `조개 부족 안내`: 프로필 shells 2로 시작 → 사기 시도 → "조개가 3개 필요해요", 🐚 2 그대로
  - `메뉴 연타해도 한 번만`(Review Focus 2): shells 6 → `[data-menu="0"]` dblclick → 🐚 3(한 잔만)
  - `옛 프로필로 들어와도 조개 3·빈손`(Review Focus 1): seed에 `cocktails:{…}`, `look.cocktail:2` → 🐚 3, 잔 숨김, 오류 없음
  - `석양멍 60초 → +1`: 석양멍 진입 후 `__app.resort.tickZen(60)`(테스트용: 60초 누적 흉내) → 🐚 +1
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 + 전체 e2e(백그라운드)**
- [ ] **Step 5: learn 문서 + Commit** `feat: 조개 줍기와 바에서 칵테일 사기`

---

### Task 5: 선베드 6세트 · 튜브 대여 · 앞바다 튜브

**Files:**
- Create: `tests/e2e/tube.spec.mjs`, `tests/e2e/sunbeds.spec.mjs`, `docs/learn/34-튜브와-선베드.md`
- Modify:
  - `src/scene/props.js`: SUNBEDS 6세트, `points.sunbeds`, `points.sunbed = SUNBEDS[0]`(호환), 튜브 거치대 메쉬+충돌 r 0.8
  - `src/app.js`: enterZen/exitZen이 `app.zenSeat`(chooseSunbed 결과)를 쓴다. taken은 `app.people`의 mode zen 위치이고, 실시간이 꺼져 있으면 빈 배열이다.
  - `src/features/resort.js`: 튜브 대여·반납, 장소 자세
  - `src/ui/resortPanels.js`: `#tube-picker`
  - `src/ui/hud.js`: `#btn-tube`
  - `styles.css`

**Interfaces:**
- Consumes: Task 2 `chooseSunbed`·`placeOf`·`world.setReach`·`player.speed`, Task 3 `avatar.setTube`·`anim.baseY`
- Produces:
  - `#btn-tube`: 거치대 2.6m 안, 모래(placeOf sand), 이동·놀기 모드일 때만 보인다. 문구는 튜브 없으면 "튜브 빌리기", 있으면 "튜브 반납".
  - `#tube-picker`: `button[data-tube="donut|flamingo|watermelon"]`(라벨 도넛·플라밍고·수박)
  - 빌리면 `profile.tube` 저장, `avatar.setTube`, `world.setReach({tube:true})`, `app.hooks.gear` 호출. 반납은 그 반대.
  - 매 프레임 내 자세(resort가 담당):
    - 튜브 + (shallow|sea) → `anim.baseY = -0.55 + sin(t·2)·0.06`, `player.speed = 2.5·0.7`
    - 그 밖(pool은 Task 6) → baseY 0, speed 2.5
  - 튜브 없이 shallow 끝(z ≤ −11.9)에 처음 닿으면 토스트 "튜브를 빌리면 더 나갈 수 있어요"(한 번만, 접속마다)

- [ ] **Step 1: 실패 e2e**
  - `tube.spec`:
    - `튜브 없이는 −12에서 멈춤 + 안내`: (0,−11) 순간이동 → ArrowUp 2초 → z ≥ −12, 토스트 문구
    - `튜브 빌려 앞바다로`:
      - 거치대 옆 순간이동 → "튜브 빌리기" → `[data-tube="flamingo"]`
      - `parts.tube` 보임 → (0,−11)에서 ArrowUp 3초 → z < −13, `anim.baseY` < −0.4
    - `바다에서는 반납 버튼이 없다`: 튜브로 z −15 → `#btn-tube` 숨김
    - `바다에서 석양멍`(Review Focus 3): 튜브로 z −15 → 석양멍 탭 → 플레이어가 선베드 근처(가장 가까운 SUNBEDS 1.5m 안), `profile.tube`는 그대로
    - `반납`: 거치대 옆 → "튜브 반납" → 튜브 숨김, 다시 −12에서 멈춤
    - `새로고침해도 튜브 유지`
  - `sunbeds.spec`:
    - `선베드 6개`: `__app.world.props.points.sunbeds.length === 6`
    - `가까운 빈 선베드`: (1.8,4)에서 석양멍 → 앉은 자리 = (1.8,2.0) 근처
    - `친구가 누운 자리는 피한다`: `openTwo`로 A를 (1.8,4)에서 석양멍 → B도 (1.8,4)에서 석양멍 → B의 자리 ≠ A의 자리
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 + 전체 e2e(백그라운드)**
- [ ] **Step 5: learn 문서 + Commit** `feat: 선베드 6세트와 튜브 타고 앞바다`

---

### Task 6: 버블풀

**Files:**
- Create: `src/scene/pool.js`, `tests/e2e/pool.spec.mjs`, `docs/learn/35-버블풀.md`
- Modify: `src/scene/props.js`(createPool 호출), `src/features/resort.js`(수영장 자세), `src/app.js`(품질 low일 때 `pool.setQuality('low')`)

**Interfaces:**
- Consumes: Task 2 `POOL`·`placeOf`, Task 3 `anim.baseY`·`anim.swim`
- Produces:
  - `createPool(scene, POOL) → { update(t, dt), setQuality('high'|'low'), bubbleCount: number }`
    - 물(밝은 청록 반투명)
    - 흰 테두리 폭 0.4·높이 0.15, 사다리
    - 비눗방울 high 40개 / low 20개: 수면에서 떠올라 1.5~3m에서 사라지고 다시
    - 거품 원판 30개
    - 수면 y −0.25
  - `world.props.pool`
  - 수영장 자세(resort):
    - pool이면 `anim.baseY` → −0.9, `anim.swim = true`, `player.speed = 2.5·0.6`
    - 높이는 목표로 서서히 바꾼다(`baseY += (target − baseY)·min(1, dt·6)`)

- [ ] **Step 1: 실패 e2e** (`pool.spec`)
  - `수영장이 있다`: `__app.world.props.pool.bubbleCount === 40`
  - `들어가면 잠긴다`: (9,14) 순간이동 → 1초 뒤 `__app.avatar.group.position.y < -0.7`, `anim.swim === true`
  - `나오면 원래대로`: (9,9) → 1초 뒤 y > −0.1, swim false
  - `수영장 들락날락 부드럽게`(Review Focus 5): 경계를 넘는 순간 다음 프레임의 y 변화량 < 0.3
  - `저품질이면 비눗방울 절반`: `__app.forceQuality('low')` → bubbleCount 20
  - `수영장에서 건배·말풍선`: 수영장 안에서 놀기→건배 → anim.state 'cheers'
  - 스크린샷 1장(`tests/e2e/__shots__/pool.png`)을 직접 확인한다.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 + 전체 e2e(백그라운드)**
- [ ] **Step 5: learn 문서 + Commit** `feat: 항상 열린 버블풀`

---

### Task 7: 친구 화면에도 — 실시간

**Files:**
- Create: `tests/e2e/resort-people.spec.mjs`, `docs/learn/36-친구도-보이게.md`
- Modify:
  - `src/net/realtime.js`: STATE_KEYS에 tube·drink. parsePresence가 tube(TUBES 아니면 null)·drink(0~3 정수 아니면 null)를 검사한다. parseMove·parsePresence 위치는 `clampFor(p, {tube:true})`로 당긴다.
  - `src/features/people.js`:
    - 내 상태에 `tube: profile.tube`, `drink: profile.drink?.cocktail ?? null`
    - `app.hooks.gear`에 setState를 건다.
    - 친구 아바타에 setTube·setDrink·setLook(face)를 적용한다.
    - 매 프레임 장소 자세(placeOf + tube)를 Task 5·6과 같은 규칙으로 정한다. 공용 함수는 `poseFor(place, tube, t) → { baseY, swim }`이고 resort.js에서 export한다.
  - `tests/unit/realtime.test.js`

**Interfaces:**
- Consumes: Task 1~6 전부. C단계 `createRealtime`, `setupPeople`
- Produces: `poseFor(place: string, tube: string|null, t: number): { baseY: number, swim: boolean }`(resort.js)

- [ ] **Step 1: 실패 테스트**
  - 단위:
    - `parsePresence tube·drink`: tube 'boat' → null, 'donut' 통과. drink 7·'1'·1.5 → null, 2 통과.
    - `parseMove z −20 → −20 유지(튜브 범위), −30 → −22`
    - `setState는 tube·drink를 실어 보내고 token은 없다`
    - `poseFor`:
      - ('pool', null) → baseY −0.9, swim true
      - ('sea', 'donut', 0) → baseY ≈ −0.55, swim false
      - ('shallow', null) → 0
  - e2e(`openTwo`):
    - `친구 표정·잔이 보인다`: A 프로필 face 'wink'·drink {cocktail:1,sips:3}로 시작 → B에서 A 아바타 faces.wink 보임, cocktail 보임(색 1)
    - `친구가 사면 바로 보인다`: A shells 3, 빈손 → 바에서 0번 사기 → B에서 A cocktail 보임(3초 안)
    - `친구 튜브는 앞바다에`(Review Focus 4): A 튜브 donut + (0,−20)으로 순간이동해 위치 보냄 → B의 A pos.z < −19, tube 보임, `anim.baseY < -0.4`
    - `친구가 수영장에 있으면 잠겨 보인다`: A (9,14) → B의 A baseY < −0.7(3초 안)
    - `이상한 tube·drink`: A에서 `__rtFake.rawTrack({..., tube:'boat', drink:9})` → B에서 그 사람 tube 숨김·cocktail 숨김, 오류 없음
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 + 전체 e2e(백그라운드)**
- [ ] **Step 5: learn 문서 + Commit** `feat: 친구 화면에도 표정·잔·튜브·수영장`

---

### Task 8: 배포 · 실서버 확인

**Files:**
- Modify: `README.md`(D단계 기능), `docs/checklist-phone.md`(10~13번: 조개·바, 표정, 튜브, 버블풀), `docs/deploy.md`(조개는 폰 저장이라는 안내)

- [ ] **Step 1: 전체 테스트** — `npm run test:sql && npm run test:unit && npx playwright test`(백그라운드) 전부 PASS
- [ ] **Step 2: 최종 리뷰**(서브에이전트, 가장 강한 모델) → Critical/Important 수정(각각 RED→GREEN) → 전체 다시 PASS
- [ ] **Step 3: 맥 동기화** — 새 이름 tgz → `Future/sunset-resort`에 풀고 추적 파일 결합 해시를 대조한다 → 사용자 Commit·Push
- [ ] **Step 4: 실서버 확인(내장 브라우저 탭 2개, `tabs_create`로 새 탭)**
  - 한쪽에서 사기·튜브·표정·수영장을 하고, 다른 쪽에서 보이는지 확인한다.
  - 콘솔 오류 0을 확인한다.
  - 확인용 프로필은 지운다.
- [ ] **Step 5: Commit** `docs: D단계 배포 안내` + 사용자에게 폰 확인 요청(체크리스트 10~13)
