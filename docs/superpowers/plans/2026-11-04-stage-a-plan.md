# Sunset Resort A단계 (혼자 쓰는 버전) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 폰 브라우저에서 휴양객 캐릭터로 석양 해변을 걷고, 놀고, 석양멍을 하고, 오늘의 칵테일을 받고, 유리병 편지를 (폰에) 띄우고, 사진을 찍는 서버 없는 웹앱을 완성한다.

**Architecture:** 번들러 없는 정적 웹앱. `index.html` 하나가 ES 모듈(`src/`)을 importmap으로 불러오고 three.js는 `vendor/three/`에 복사본을 둔다. 순수 로직(`src/state/`)은 DOM·WebGL 없이 Node 단위 테스트로 검증하고, 3D(`src/scene/`, `src/character/`)와 UI(`src/ui/`)는 Playwright 헤드리스 브라우저로 검증한다. `src/app.js`가 모드 상태 기계(move / play / zen / messages)로 전체를 조립한다.

**Tech Stack:** HTML/CSS/JavaScript(ES2022 모듈), three.js 0.170.0(벤더), Node 22 내장 `node:test`, Playwright(컨테이너에 설치된 Chromium, SwiftShader WebGL), Web Audio API, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-11-04-sunset-resort-design.md` (3절 A 항목, 4절, 5.1절, 6~9절, 11절이 이 계획의 범위)

## Global Constraints

- three.js는 `vendor/three/`의 0.170.0 복사본만 사용. CDN·번들러·npm 런타임 의존 없음. 외부 3D 모델·텍스처 파일 없음(기본 도형만).
- 모든 소스 파일 첫 줄은 `// 이 파일이 하는 일: …` 한국어 주석.
- 닉네임: trim 후 2~10자, 한글(가-힣)·영문·숫자만. 추천 생성은 형용사+공백+명사.
- 저장 키 `sunset-resort:v1`, 저장 실패 시 메모리 폴백 + 안내 "이번엔 저장이 안 돼요".
- 날짜 기준은 KST(UTC+9) 자정. 오늘의 칵테일 하루 5잔. 석양 이벤트 19:00 KST. 무드: 골든아워 18:30~19:00, 드라마틱 19:00~19:30, 그 외 파스텔.
- 이동 속도 2.5 단위/초. 이동 가능 범위: 모래(z ≥ −9)와 얕은 물(−12 ≤ z < −9), x는 −30~30. 병 구역 x −18~18, z −24~−12.
- 병 모양 6종 키: `round, tall, square, jar, heart, star`. 메시지 1~50자.
- 꾸미기 값: `hat ∈ {straw, bucket, none}`, `glasses ∈ {true,false}`, `shirt ∈ 6색 인덱스 0~5`, `cocktail ∈ 0~3`.
- UI 문구는 스펙 그대로: 탭 "이동하기 / 놀기 / 석양멍하기 / 메시지 보기 / 사진찍기", 석양멍 문구 "석양이 지는 동안, 아무것도 하지 않아도 괜찮아요", 버튼 "석양멍 끝내기", WebGL 실패 "이 브라우저에서는 3D를 켤 수 없어요", 병 완료 "편지가 바다에 띄워졌어요".
- 성능: 픽셀 밀도 최대 2, 그림자 맵 1024, 첫 3초 평균 30fps 미만이면 그림자 끄고 파도 세분화 절반.
- 컨테이너의 Playwright Chromium은 `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`로 띄운다.
- 작업 폴더: 컨테이너 `/home/claude/sunset-resort`(git). 각 Task 끝에 변경 파일을 사용자 맥 `Future/sunset-resort/`에 동기화한다(사용자가 GitHub Desktop으로 Push).

## Review Focus

1. 앱을 켜둔 채 KST 자정을 넘기면 "오늘의 칵테일"이 0/5로 돌아와야 한다 → Task 3 `daily` 테스트에 "자정 경계" 케이스.
2. 백그라운드에 있다가 돌아오면 큰 dt가 들어와 캐릭터가 순간이동하면 안 된다 → Task 8 `player.step`은 dt를 0.05초로 상한.
3. 저장된 JSON이 깨져 있으면 기본값으로 시작해야 한다(앱이 하얗게 죽지 않음) → Task 2 `storage.load` 손상 JSON 테스트.
4. 화면 회전·리사이즈 시 캔버스 크기와 조이스틱 위치가 따라와야 한다 → Task 1 리사이즈 e2e, Task 8 조이스틱 "리셋 후 재생성" 테스트.
5. 조이스틱을 잡은 채 탭을 바꾸거나 포인터가 취소되면 입력이 0으로 돌아와야 한다 → Task 8 `pointercancel` 테스트.

---

## 파일 구조

```
sunset-resort/
  index.html                 importmap, 캔버스, UI 뼈대(진입·HUD·패널 컨테이너)
  styles.css                 테마 토큰, 레이아웃, 탭·패널·조이스틱 스타일
  package.json               scripts: test:unit, test:e2e, serve
  playwright.config.mjs      webServer(scripts/serve.mjs), chromium args
  scripts/serve.mjs          정적 파일 서버(테스트·로컬 확인용)
  vendor/three/              three.module.js, three.core.js (npm three@0.170.0 build/)
  src/main.js                부팅: 렌더러 생성 → 프로필 로드 → 진입 or 메인
  src/app.js                 모드 상태 기계, 프레임 루프, 모듈 조립, window.__app(테스트용)
  src/state/storage.js       load/save/isPersistent, 메모리 폴백
  src/state/nickname.js      suggest(), validate()
  src/state/profile.js       기본 프로필, 토큰 생성, 꾸미기 값 검증
  src/state/daily.js         kstDateKey(), CocktailCounter
  src/state/mood.js          PALETTES, moodAt(date)
  src/state/bottles.js       validateBottle(), BottleStore(폰 저장)
  src/state/quality.js       decideQuality(avgFps)
  src/scene/renderer.js      createRenderer(canvas) | null, resize
  src/scene/sky.js           createSky(scene) → { applyMood(palette, t) }
  src/scene/water.js         createWater(scene, {segments}) → { update(t) }
  src/scene/beach.js         createBeach(scene) (모래·젖은 모래·섬)
  src/scene/props.js         createProps(scene) → { colliders, points }
  src/scene/world.js         clampToBeach(p), resolveColliders(p, r, circles), createWorld(scene)
  src/scene/camera.js        createCameraRig(camera) → follow/zen/drag
  src/scene/bottles3d.js     createBottleMesh(shape), BottleField(scene)
  src/character/avatar.js    buildAvatar(look) → { group, parts, setLook(look) }
  src/character/animations.js AnimationController(parts)
  src/character/player.js    createPlayer({avatar, world}) → step(dt, input)
  src/ui/joystick.js         createJoystick(el) → { vector, reset }
  src/ui/keyboard.js         createKeyboard() → { vector }
  src/ui/entry.js            진입 화면
  src/ui/hud.js              상단 칩·배지·우측 버튼·하단 탭, 모드 이벤트
  src/ui/panels.js           꾸미기·놀기 바·병 쓰기·메시지 보기·토스트
  src/ui/zen.js              석양멍 오버레이·타이머
  src/ui/photo.js            capture(renderer, scene, camera, {nickname}) → Blob
  src/audio/waves.js         createWaveSound() → { start, stop }
  tests/unit/*.test.js       node:test
  tests/e2e/*.spec.mjs       Playwright
  docs/learn/NN-*.md         각 Task의 "이 코드가 하는 일" 설명(사용자 학습용)
  docs/deploy.md             GitHub Desktop·Pages 절차
```

---

### Task 1: 프로젝트 뼈대 · three.js 벤더 · 렌더러 · 테스트 러너

**Files:**
- Create: `index.html`, `styles.css`, `package.json`, `playwright.config.mjs`, `scripts/serve.mjs`, `src/main.js`, `src/scene/renderer.js`, `vendor/three/*`, `tests/e2e/smoke.spec.mjs`, `docs/learn/01-뼈대.md`

**Interfaces:**
- Produces: `createRenderer(canvas: HTMLCanvasElement): {renderer: THREE.WebGLRenderer, resize(): void} | null` (WebGL 불가 시 null). `index.html`의 요소 id: `#c`(캔버스), `#entry`, `#hud`, `#panels`, `#zen`, `#toast`, `#fatal`(오류 안내).
- importmap: `"three": "./vendor/three/three.module.js"`.

- [ ] **Step 1: 저장소 초기화와 three.js 벤더**

Run: `mkdir -p /home/claude/sunset-resort && cd /home/claude/sunset-resort && git init -b main && npm pack three@0.170.0 && tar -xzf three-0.170.0.tgz && mkdir -p vendor/three && cp package/build/three.module.js package/build/three.core.js vendor/three/ && rm -rf package three-0.170.0.tgz`
Expected: `vendor/three/three.module.js`가 존재하고 `grep -c "from './three.core.js'" vendor/three/three.module.js`가 1 이상. (`three.core.js`가 없는 버전이면 `three.module.js`만 복사.)

- [ ] **Step 2: `package.json`, `scripts/serve.mjs`, `playwright.config.mjs` 작성**

`package.json` scripts: `"test:unit": "node --test tests/unit/"`, `"test:e2e": "playwright test"`, `"serve": "node scripts/serve.mjs"`. `serve.mjs`는 `http` 모듈로 프로젝트 루트를 포트 4173에 서빙(확장자별 Content-Type: html/js/css/json/png). Playwright config: `webServer: { command: 'npm run serve', port: 4173 }`, `use: { baseURL: 'http://127.0.0.1:4173', viewport: {width: 390, height: 844} }`, chromium `launchOptions.args`는 Global Constraints의 플래그. Playwright 패키지는 컨테이너에 전역 설치된 것을 `require('playwright')`로 쓰며 `playwright install`은 실행하지 않는다.

- [ ] **Step 3: 실패하는 스모크 테스트 작성** — `tests/e2e/smoke.spec.mjs`

```js
test('페이지가 뜨고 캔버스에 그림이 그려진다', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.waitForTimeout(800);
  const painted = await page.evaluate(() => window.__app?.paintedPixels ?? 0);
  expect(errors).toEqual([]); expect(painted).toBeGreaterThan(1000);
});
test('리사이즈하면 캔버스 크기가 따라온다', async ({ page }) => {
  await page.goto('/'); await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(200);
  const size = await page.evaluate(() => [window.__app.canvasSize.w, window.__app.canvasSize.h]);
  expect(size[0]).toBeGreaterThan(size[1]);
});
```

- [ ] **Step 4: 테스트 실패 확인** — Run: `npx playwright test tests/e2e/smoke.spec.mjs` Expected: FAIL (페이지 없음 / `__app` undefined)

- [ ] **Step 5: `index.html`, `styles.css`, `src/scene/renderer.js`, `src/main.js` 구현**

`index.html`: viewport-fit=cover, importmap, `<canvas id="c">`, 빈 컨테이너 div들, `<script type="module" src="./src/main.js">`. `styles.css`: `:root` 토큰(배경 #171a2b, 글자 #f2e9dd, 강조 #ff9a62, 칩 배경 rgba(23,26,43,.72)), `html,body{height:100%}`, 캔버스 `position:fixed; inset:0`, safe-area 패딩. `createRenderer`: WebGL2 컨텍스트 확인 실패 시 null; 성공 시 antialias, `setPixelRatio(Math.min(devicePixelRatio,2))`, shadowMap PCFSoft, SRGB, ACESFilmic 노출 1.05, `resize()`는 `window.innerWidth/Height`. `main.js`: null이면 `#fatal`에 "이 브라우저에서는 3D를 켤 수 없어요" 표시; 아니면 임시로 하늘색 배경 장면 하나를 그리고 `window.__app = { paintedPixels, canvasSize }`를 채운다(`paintedPixels`는 렌더 후 `readPixels`로 배경색과 다른 픽셀 수를 64×64 샘플링으로 셈 — 이 헬퍼는 `renderer.js`의 `countPaintedPixels(renderer, bg)`로 둔다).

- [ ] **Step 6: 테스트 통과 확인** — Run: `npx playwright test tests/e2e/smoke.spec.mjs` Expected: 2 passed

- [ ] **Step 7: WebGL 없는 환경 테스트 추가** — `tests/e2e/smoke.spec.mjs`에 `test.describe`로 `browser.newContext` 대신 `chromium.launch({args:[...,'--disable-3d-apis']})`를 직접 띄워 `#fatal`의 텍스트가 "이 브라우저에서는 3D를 켤 수 없어요"임을 확인. Run → PASS.

- [ ] **Step 8: `docs/learn/01-뼈대.md` 작성** (10줄 내외: index.html·importmap·renderer가 각각 무엇인지)

- [ ] **Step 9: Commit** — `git add -A && git commit -m "chore: 프로젝트 뼈대, three.js 벤더, 렌더러, 스모크 테스트"` 그리고 사용자 폴더 동기화.

---

### Task 2: 저장소 · 닉네임 · 프로필

**Files:**
- Create: `src/state/storage.js`, `src/state/nickname.js`, `src/state/profile.js`, `tests/unit/storage.test.js`, `tests/unit/nickname.test.js`, `tests/unit/profile.test.js`, `docs/learn/02-저장과-닉네임.md`

**Interfaces:**
- Produces: `createStorage(backend = globalThis.localStorage): { load(): object, save(obj): boolean, isPersistent: boolean }` — 키 `sunset-resort:v1`, 백엔드가 throw 하면 메모리로 폴백하고 `isPersistent=false`.
- `suggestNickname(rng = Math.random): string`, `validateNickname(raw: string): { ok: true, value: string } | { ok: false, reason: 'length' | 'chars' }`.
- `ADJECTIVES: string[]`(12개 이상, 예: 나른한·선셋·느긋한), `NOUNS: string[]`(12개 이상, 예: 코코넛·플라밍고·파라솔).
- `defaultProfile(): { token: string, nickname: string, look: { hat, glasses, shirt, cocktail }, zenSeconds: 0, cocktails: { date: '', count: 0 }, bottles: [] }` (token은 `crypto.randomUUID()`), `normalizeLook(look): look`(범위 밖 값은 기본값 `{hat:'straw', glasses:true, shirt:0, cocktail:0}`으로).

- [ ] **Step 1: 실패하는 단위 테스트 작성** (세 파일)

```js
// storage.test.js
test('없으면 빈 객체', () => assert.deepEqual(createStorage(fakeLS()).load(), {}));
test('save 후 load가 같다', ...);
test('깨진 JSON이면 빈 객체', () => { const ls = fakeLS({'sunset-resort:v1': '{oops'}); assert.deepEqual(createStorage(ls).load(), {}); });
test('백엔드가 throw 하면 메모리 폴백, isPersistent=false', ...);
// nickname.test.js
test('추천은 형용사+공백+명사이고 검증을 통과한다', ...);
test('"  바다  " → ok 바다', ...); test('"a" → length', ...); test('11자 → length', ...); test('"hi!" → chars', ...);
// profile.test.js
test('defaultProfile의 token은 UUID 형식', ...); test('normalizeLook은 범위 밖 값을 기본값으로', () => assert.deepEqual(normalizeLook({hat:'cap', shirt:9}), {hat:'straw', glasses:true, shirt:0, cocktail:0}));
```

- [ ] **Step 2: 실패 확인** — Run: `npm run test:unit` Expected: FAIL (모듈 없음)
- [ ] **Step 3: 세 모듈 구현** (Interfaces의 시그니처대로)
- [ ] **Step 4: 통과 확인** — Run: `npm run test:unit` Expected: 모두 PASS
- [ ] **Step 5: `docs/learn/02-저장과-닉네임.md` 작성**
- [ ] **Step 6: Commit** — `git commit -m "feat: 저장소·닉네임·프로필 상태 모듈"` + 동기화

---

### Task 3: KST 일일 카운터 · 무드 시각

**Files:**
- Create: `src/state/daily.js`, `src/state/mood.js`, `tests/unit/daily.test.js`, `tests/unit/mood.test.js`, `docs/learn/03-날짜와-무드.md`

**Interfaces:**
- Produces: `kstDateKey(date: Date): string`("YYYY-MM-DD", UTC+9 기준). `class CocktailCounter { constructor(state = {date:'', count:0}, max = 5); take(now: Date): { ok: boolean, count: number }; remaining(now): number; toJSON() }` — 날짜 키가 바뀌면 count를 0으로.
- `PALETTES: { pastel, golden, dramatic }` 각각 `{ top, mid, horizon, sun, glow, water, fog, light, lightIntensity, hemiSky, hemiGround }` 16진수 문자열(목업 값 그대로). `moodAt(date: Date): 'pastel' | 'golden' | 'dramatic'`. `EVENT_HOUR = 19`.

- [ ] **Step 1: 실패하는 테스트 작성**

```js
test('UTC 2026-11-04T14:59Z는 KST 11-04, 15:00Z는 11-05', ...);
test('5잔 뒤 take는 ok:false, count 5', ...);
test('자정 경계: 23:59 KST에 3잔 → 00:00 KST에 remaining 5', ...);
test('18:29 pastel, 18:30 golden, 19:00 dramatic, 19:29 dramatic, 19:30 pastel (KST)', ...);
```

- [ ] **Step 2: 실패 확인** — `npm run test:unit` Expected: FAIL
- [ ] **Step 3: 구현** — KST 변환은 `new Date(date.getTime() + 9*3600*1000)`의 UTC 필드 사용(타임존 라이브러리 없음).
- [ ] **Step 4: 통과 확인** — PASS
- [ ] **Step 5: `docs/learn/03-날짜와-무드.md`** · **Step 6: Commit** `feat: KST 일일 카운터와 무드 시각` + 동기화

---

### Task 4: 하늘 · 조명 · 바다 · 모래

**Files:**
- Create: `src/scene/sky.js`, `src/scene/water.js`, `src/scene/beach.js`, `tests/e2e/scene.spec.mjs`, `docs/learn/04-하늘-바다-모래.md`
- Modify: `src/main.js`(임시 장면 대신 세 모듈 조립, 카메라 (0,3.2,8)→(0,0.9,0) 고정)

**Interfaces:**
- Produces: `createSky(scene): { applyMood(palette, blend = 1), sunLight: DirectionalLight, setShadows(on: boolean) }` — 하늘돔(반지름 300, 3색 셰이더), 태양 원판(반지름 12, (0,9,−250)), 글로우 스프라이트(70), 반구광, 주광(그림자 맵 1024, 범위 ±18), 보조광, `scene.fog`.
- `createWater(scene, { segments = 70 }): { mesh, segments, update(t), setSegments(n) }` — 420×420 평면, y −0.12, 감쇠식 `amp = 0.12 + 0.88·clamp((−9 − z)/13, 0, 1)`.
- `createBeach(scene): { mesh }` — 물결 해안선 Shape(y=9 기준 ±2.2, 6단위 간격)을 depth 0.6 Extrude 후 `rotateX(−π/2)`·`translate(0,−0.6,0)`, 젖은 모래 띠(200×2.6, y −0.04, z −10.4), 먼 섬 2개.
- `window.__app.samplePixel(xFrac, yFrac): [r,g,b]`(테스트용, renderer.js에 추가).

- [ ] **Step 1: 실패하는 e2e 작성** — `scene.spec.mjs`

```js
test('위는 하늘, 가운데는 바다, 아래는 모래 색이다', async ({ page }) => {
  await page.goto('/'); await page.waitForTimeout(800);
  const [sky, sea, sand] = await page.evaluate(() => [[0.5,0.08],[0.5,0.42],[0.5,0.9]].map(p => window.__app.samplePixel(...p)));
  expect(sea[2]).toBeGreaterThan(sea[0]);           // 바다는 파란 성분이 큼
  expect(sand[0]).toBeGreaterThan(sand[2]);         // 모래는 붉은/노란 성분이 큼
  expect(sky[0] + sky[1] + sky[2]).toBeGreaterThan(sea[0] + sea[1] + sea[2]); // 하늘(석양)이 바다보다 밝음
});
test('무드를 바꾸면 하늘 색이 달라진다', ...); // __app.applyMood('dramatic') 전후 sky 픽셀 비교
```

- [ ] **Step 2: 실패 확인** — FAIL
- [ ] **Step 3: 세 모듈 구현 + main.js 조립** (목업의 셰이더·수치 재사용. `__app.applyMood(name)` 노출)
- [ ] **Step 4: 통과 확인 + 스크린샷 육안 확인** — `npx playwright test tests/e2e/scene.spec.mjs` PASS 후 `page.screenshot`을 `tests/e2e/__shots__/scene-phone.png`로 남기고 Read로 확인(바다·모래 겹침 없음).
- [ ] **Step 5: `docs/learn/04-…md`** · **Step 6: Commit** `feat: 하늘·바다·모래 장면` + 동기화

---

### Task 5: 소품 · 충돌 · 월드

**Files:**
- Create: `src/scene/props.js`, `src/scene/world.js`, `tests/unit/world.test.js`, `docs/learn/05-소품과-충돌.md`
- Modify: `src/main.js`(createWorld 사용)

**Interfaces:**
- Produces: `createProps(scene): { colliders: {x,z,r}[], points: { sunbed: {x,z,ry}, bar: {x,z}, bottleArea: {xMin:-18,xMax:18,zMin:-24,zMax:-12} } }` — 야자수 5그루(목업 좌표), 방갈로 2채, 선베드 세트 (5.3,0,2.0) ry −0.45, 해변 바(−5.5, 0, 4: 카운터 상자 2.4×1.0×0.8 + 지붕 + 칵테일 잔 3개).
- `clampToBeach({x,z}): {x,z}` — x −30~30, z −12~40. `resolveColliders(p: {x,z}, r: number, circles): {x,z}` — 겹치면 원 밖으로 밀어냄.
- `createWorld(scene): { props, clamp(p, r=0.4): {x,z} }` — clamp = clampToBeach ∘ resolveColliders.

- [ ] **Step 1: 실패 테스트** — `world.test.js`: `clampToBeach({x:50,z:-20}) → {x:30,z:-12}`; `resolveColliders({x:0,z:0}, .4, [{x:0.5,z:0,r:1}])`의 결과가 원 중심에서 1.4 이상 떨어짐; 겹치지 않으면 그대로.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인**(`npm run test:unit`) · 스모크 e2e 재실행 PASS
- [ ] **Step 5: `docs/learn/05-…md`** · **Step 6: Commit** `feat: 소품·충돌·월드` + 동기화

---

### Task 6: 휴양객 아바타와 꾸미기

**Files:**
- Create: `src/character/avatar.js`, `tests/unit/avatar.test.js`, `docs/learn/06-캐릭터.md`
- Modify: `src/main.js`(아바타를 (0,0,0)에 추가)

**Interfaces:**
- Produces: `SHIRT_COLORS: string[6]`, `COCKTAIL_COLORS: string[4]`. `buildAvatar(look): { group: THREE.Group, parts: { head, torso, armL, armR, legL, legR, hatStraw, hatBucket, glasses, cocktail }, setLook(look) }` — 목업 A의 부품 구성. `setLook`은 모자 메쉬 `visible` 토글, 선글라스 `visible`, 셔츠·칵테일 재질 color 교체.
- Node에서 three.js를 import해 테스트(WebGL 불필요).

- [ ] **Step 1: 실패 테스트** — `buildAvatar(default)`에 parts 10개가 모두 Object3D; `setLook({hat:'none'})` 후 두 모자 모두 `visible=false`; `setLook({shirt:3})` 후 `parts.torso.material.color.getHexString() === SHIRT_COLORS[3].slice(1)`; 전체 높이(Box3) 1.6~1.9.
- [ ] **Step 2: 실패 확인** · **Step 3: 구현** · **Step 4: 통과 확인** · **Step 5: `docs/learn/06-…md`** · **Step 6: Commit** `feat: 휴양객 아바타` + 동기화

---

### Task 7: 애니메이션 상태 기계

**Files:**
- Create: `src/character/animations.js`, `tests/unit/animations.test.js`, `docs/learn/07-동작.md`

**Interfaces:**
- Produces: `EMOTES = { wave: 1.6, cheers: 1.4, dance: 2.4, lie: Infinity, throw: 1.2, drink: 1.5 }`(초). `class AnimationController { constructor(parts); state: 'idle'|'walk'|keyof EMOTES; setMoving(bool); play(emote); stop(); update(dt) }` — `play`는 이동 중이면 무시하지 않고 이동을 멈춘 상태로 재생, 지속시간이 지나면 `idle`(lie는 `stop()`까지 유지). `update`는 팔·다리 rotation.x를 사인으로 흔들고(걷기 주파수 2π·2.2), 춤은 몸통 rotation.y 흔들기, 건배/마시기는 armR 들어올리기, 눕기는 group을 뒤로 눕힘(rotation.x −π/2+0.35, 위치 y 0.5) — 수치는 구현 재량.

- [ ] **Step 1: 실패 테스트** — 초기 idle; `setMoving(true)` → walk; `play('wave')` 후 `update(1.7)` → idle; `play('lie')` 후 `update(100)` → lie, `stop()` → idle; walk 중 `update(0.3)` 뒤 `parts.legL.rotation.x !== 0`.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과** · **Step 5: `docs/learn/07-…md`** · **Step 6: Commit** `feat: 애니메이션 상태 기계` + 동기화

---

### Task 8: 입력(조이스틱·키보드) · 플레이어 이동 · 카메라

**Files:**
- Create: `src/ui/joystick.js`, `src/ui/keyboard.js`, `src/character/player.js`, `src/scene/camera.js`, `tests/unit/joystick.test.js`, `tests/unit/player.test.js`, `tests/e2e/move.spec.mjs`, `docs/learn/08-이동과-카메라.md`
- Modify: `src/main.js`(플레이어·카메라 조립, 프레임 루프에서 `player.step`)

**Interfaces:**
- Produces: `joystickVector(origin, current, radius = 60): {x, y}`(길이 0~1로 정규화, 순수 함수). `createJoystick(layerEl): { vector: {x,y}, active: boolean, reset(), destroy() }` — 레이어 어디든 `pointerdown`에 그 자리에 `.stick` 요소 생성, `pointermove`로 vector 갱신, `pointerup/pointercancel`에 vector {0,0}·요소 제거.
- `createKeyboard(target = window): { vector: {x,y}, destroy() }` — WASD·방향키.
- `createPlayer({ avatar, anim, world, speed = 2.5 }): { position: Vector3, heading: number, step(dt, input: {x,y}, camYaw: number) }` — 입력은 카메라 기준(앞=카메라 전방), dt는 `Math.min(dt, 0.05)`, 이동 시 `anim.setMoving(true)`·heading을 이동 방향으로 회전, 위치는 `world.clamp`.
- `createCameraRig(camera): { mode: 'follow'|'zen'|'fixed', yaw, pitch, follow(target: Vector3), setZen(seatPos, lookAt), setFixed(pos, lookAt), dragBy(dx, dy), update(dt) }` — follow: 거리 6.5, 높이 2.6, yaw는 드래그, pitch 0.3~1.3 제한, 부드럽게 lerp 0.08.
- `window.__app.player`, `__app.cameraRig`, `__app.pressKey(code, down)` 노출.

- [ ] **Step 1: 실패 테스트**

```js
// joystick.test.js
test('원점이면 0벡터', ...); test('오른쪽 60px → x 1, y 0', ...); test('120px 끌어도 길이 1 이하', ...);
// player.test.js (fake world: clamp = identity)
test('입력 {x:0,y:1} 1초 → z가 -2.5 (camYaw 0)', ...); test('dt 5초를 넣어도 0.05초만 이동', ...); test('입력 0이면 anim.setMoving(false)', ...);
// move.spec.mjs
test('ArrowUp을 1초 누르면 캐릭터가 앞으로 간다', ...); // __app.player.position.z 비교
test('조이스틱: 터치 다운-무브-캔슬 후 vector는 0', ...); // page.touchscreen / dispatchEvent('pointercancel')
test('가로로 회전한 뒤 조이스틱을 다시 만들 수 있다', ...);
```

- [ ] **Step 2~4: 실패 확인 → 구현 → 통과**(unit + e2e) · **Step 5: `docs/learn/08-…md`** · **Step 6: Commit** `feat: 조이스틱·키보드·플레이어·카메라` + 동기화

---

### Task 9: 진입 화면 · HUD · 모드 상태 기계(app.js)

**Files:**
- Create: `src/app.js`, `src/ui/entry.js`, `src/ui/hud.js`, `tests/e2e/entry-hud.spec.mjs`, `docs/learn/09-화면-흐름.md`
- Modify: `src/main.js`(조립 코드를 app.js로 이동; main.js는 렌더러 생성·오류 안내·`createApp` 호출만), `index.html`, `styles.css`

**Interfaces:**
- Produces: `createApp({ renderer, storage, profile }): { mode, setMode(m: 'move'|'play'|'zen'|'messages'), profile, saveProfile(), world, player, ... }` 와 `window.__app = app`(테스트 노출 유지). `document.body.dataset.mode`에 현재 모드.
- `renderEntry(root, { profile, onDone(profile) })` — 닉네임 입력(`#nick`, 추천 미리 채움), "다른 이름 추천"(`#nick-shuffle`), 꾸미기 컨트롤(모자 3버튼·선글라스 토글·셔츠 6스와치·칵테일 4스와치), "해변으로 가기"(`#enter`). 검증 실패 시 `#nick-error` 문구: length → "2~10자로 적어주세요", chars → "한글·영문·숫자만 쓸 수 있어요".
- `renderHud(root, { profile, onTab(mode), onCustomize(), onWriteBottle(), onGoSea() })` — 칩 `#chip-nick`, 배지 `#badge-cocktail`("오늘의 칵테일 n/5"), `#badge-event`("매일 오후 7시 석양 이벤트"), 우측 `#btn-bottle`("유리병 편지 쓰기")·`#btn-sea`("바다로 가기"), 탭 5개 `button.tab[data-mode]`. `hud.setCocktail(n)`, `hud.setPeople(n|null)`(C 대비, null이면 숨김).
- 저장된 닉네임이 있으면 진입 화면을 건너뛰고 바로 메인.

- [ ] **Step 1: 실패 e2e** — 첫 방문: `#nick` 값이 추천 형식(정규식 `^\S+ \S+$`); "a" 입력 후 `#enter` → `#nick-error` "2~10자로 적어주세요"; "세민" 입력 → 메인(`body[data-mode=move]`, `#chip-nick` 텍스트 "세민"); 탭 클릭마다 `data-mode` 변경; 새로고침하면 진입 화면 없이 메인.
- [ ] **Step 2~4: 실패 확인 → 구현 → 통과**(전체 e2e 재실행) · **Step 5: `docs/learn/09-…md`** · **Step 6: Commit** `feat: 진입 화면·HUD·모드 상태 기계` + 동기화

---

### Task 10: 놀기 바 · 꾸미기 패널 · 토스트

**Files:**
- Create: `src/ui/panels.js`, `tests/e2e/play.spec.mjs`, `docs/learn/10-패널.md`
- Modify: `src/app.js`, `styles.css`

**Interfaces:**
- Produces: `showToast(text, ms = 2200)`. `renderPlayBar(root, { onEmote(name) })` — 버튼 5개 `button.emote[data-emote]`: wave "인사", cheers "건배", dance "춤", lie "눕기", throw "비치볼". `renderCustomizePanel(root, { look, onChange(look), onClose })`(진입 화면의 꾸미기 컨트롤을 재사용: `src/ui/entry.js`에서 `renderLookControls(root, look, onChange)`로 분리).
- 이펙트: `src/scene/effects.js`의 `spawnHearts(scene, pos)`(건배·인사), `spawnBall(scene, from, dir)`(비치볼: 포물선 1.2초 후 제거).

- [ ] **Step 1: 실패 e2e** — 놀기 탭 → 버튼 5개 보임; "건배" 클릭 → `__app.anim.state === 'cheers'`, 1.5초 뒤 idle; "눕기" → lie 유지, 이동 입력 시 idle; 꾸미기에서 셔츠 3번 선택 → 저장 후 새로고침해도 `__app.profile.look.shirt === 3`.
- [ ] **Step 2~4** · **Step 5: `docs/learn/10-…md`** · **Step 6: Commit** `feat: 놀기 바·꾸미기 패널·이펙트` + 동기화

---

### Task 11: 석양멍 모드 · 파도 소리

**Files:**
- Create: `src/ui/zen.js`, `src/audio/waves.js`, `tests/unit/zen.test.js`, `tests/e2e/zen.spec.mjs`, `docs/learn/11-석양멍.md`
- Modify: `src/app.js`, `src/scene/camera.js`(zen 미세 흔들림 sin(t·0.25)·0.04)

**Interfaces:**
- Produces: `formatZen(seconds): string`("3분째" / "1시간 12분째", 60초 미만 "잠시"). `renderZen(root, { onEnd(), onSound(on) })` — 문구, `#zen-time`, `#zen-end`("석양멍 끝내기"), `#zen-sound`("파도 소리 켜기/끄기", 기본 꺼짐). `createWaveSound(): { start(), stop() }` — Web Audio 핑크 노이즈 + 로우패스 + 7초 주기 게인 LFO; 파일 없음.
- app: zen 진입 시 플레이어를 선베드로 순간 이동·`anim.play('lie')`·`cameraRig.setZen(...)`·HUD 숨김, 매초 `profile.zenSeconds++` 저장, 종료 시 복귀.

- [ ] **Step 1: 실패 테스트** — unit: `formatZen(30)→'잠시'`, `(180)→'3분째'`, `(4320)→'1시간 12분째'`. e2e: 석양멍 탭 → `#hud` 숨김, 문구 표시, `__app.cameraRig.mode==='zen'`, 3초 뒤 `profile.zenSeconds ≥ 2`; 끝내기 → `mode==='follow'`, HUD 복귀.
- [ ] **Step 2~4** · **Step 5: `docs/learn/11-…md`** · **Step 6: Commit** `feat: 석양멍 모드와 파도 소리` + 동기화

---

### Task 12: 오늘의 칵테일 · 해변 바 · 석양 이벤트 연출

**Files:**
- Create: `tests/e2e/daily.spec.mjs`, `docs/learn/12-칵테일과-석양이벤트.md`
- Modify: `src/app.js`, `src/ui/hud.js`, `src/scene/sky.js`(두 팔레트 사이 blend)

**Interfaces:**
- Consumes: `CocktailCounter`, `moodAt`, `PALETTES`, `hud.setCocktail`.
- Produces: app이 플레이어가 바 2.0 단위 안에 들어오면 `#btn-take`("칵테일 받기") 표시 → 클릭 시 `counter.take(now)`; ok면 `anim.play('drink')`·배지 갱신·저장, 아니면 토스트 "오늘 칵테일은 다 마셨어요. 내일 또 만나요". 10초마다 `moodAt(new Date())`로 무드를 2초에 걸쳐 blend; 19:00 진입 순간 토스트 "석양 이벤트가 시작됐어요".
- `window.__app.setNow(fn)`: 테스트용 시계 주입(기본 `() => new Date()`).

- [ ] **Step 1: 실패 e2e** — `__app.player.position`을 바 앞으로 옮긴 뒤 "칵테일 받기" 5번 → 배지 "오늘의 칵테일 5/5", 6번째는 토스트; `setNow`로 KST 19:05 → 1초 내 `__app.currentMood==='dramatic'`; 다음 날 00:01로 바꾸면 배지 0/5.
- [ ] **Step 2~4** · **Step 5: `docs/learn/12-…md`** · **Step 6: Commit** `feat: 오늘의 칵테일·석양 이벤트` + 동기화

---

### Task 13: 유리병 편지(폰 저장) · 메시지 보기

**Files:**
- Create: `src/state/bottles.js`, `src/scene/bottles3d.js`, `tests/unit/bottles.test.js`, `tests/e2e/bottles.spec.mjs`, `docs/learn/13-유리병-편지.md`
- Modify: `src/ui/panels.js`(병 쓰기 패널·위치 선택·메시지 보기), `src/app.js`, `src/ui/hud.js`

**Interfaces:**
- Produces: `SHAPES = ['round','tall','square','jar','heart','star']`, `validateBottle({shape, message, x, z}): {ok:true, value} | {ok:false, reason:'shape'|'message'|'position'}`. `class BottleStore { constructor(profileBottles: array, save: fn); add(bottle): bottle(id=randomUUID, createdAt, likes 0); list(): bottle[] }` — B단계에서 같은 인터페이스의 서버 구현으로 교체.
- `createBottleMesh(shape): THREE.Group`(6종 기본 도형 조합, 코르크·라벨 포함), `createBottleField(scene): { set(bottles), count, update(t) }` — 둥실 애니메이션 y = −0.05 + sin(t + id해시)·0.06, 최대 200개.
- "바다로 가기"(`#btn-sea`): `cameraRig.setFixed({x:0,y:4,z:-4}, {x:0,y:0,z:-18})`로 병 구역을 내려다보고, 같은 버튼이 "돌아가기"로 바뀌어 누르면 `follow`로 복귀.
- 패널: `#bottle-shape`(6버튼) → `#bottle-msg`(maxlength 50, 글자수 `n/50`) → "바다에 띄우기" → 위치 선택 모드(바다 탭하면 병 구역으로 clamp된 위치에 미리보기, "여기에 띄우기") → 토스트 "편지가 바다에 띄워졌어요" + 공유 링크 칸(`#bottle-link`, 값 `location.origin + location.pathname + '#b=' + id`, 복사 버튼). 메시지 보기 패널: 내 병 목록(모양·메시지·날짜·좋아요 수), 비어 있으면 "아직 띄운 편지가 없어요".
- 실패 시(`validateBottle` fail): message → "1~50자로 적어주세요", position → "앞바다 안에서 골라주세요".

- [ ] **Step 1: 실패 테스트** — unit: 51자 → message; `{x:0,z:0}` → position; `{shape:'cup'}` → shape; `BottleStore.add` 후 `list().length===1`, id가 UUID, save 호출됨. e2e: 쓰기 플로우 끝까지 → `__app.bottleField.count===1`, 메시지 보기에 1개, 새로고침 후에도 1개.
- [ ] **Step 2~4** · **Step 5: `docs/learn/13-…md`** · **Step 6: Commit** `feat: 유리병 편지(폰 저장)·메시지 보기` + 동기화

---

### Task 14: 사진찍기

**Files:**
- Create: `src/ui/photo.js`, `tests/e2e/photo.spec.mjs`, `docs/learn/14-사진.md`
- Modify: `src/app.js`, `src/scene/renderer.js`(`preserveDrawingBuffer` 없이 렌더 직후 캡처하는 `captureFrame(renderer, scene, camera): HTMLCanvasElement`)

**Interfaces:**
- Produces: `async takePhoto({ renderer, scene, camera, nickname, appName = 'Sunset Resort' }): Blob` — 캡처 캔버스에 왼쪽 아래 워터마크(`${appName} · ${nickname}`, 반투명 흰 글씨) 후 PNG Blob. `sharePhoto(blob, filename)`: `navigator.canShare?.({files})`면 공유 시트, 아니면 `<a download>` 클릭. `window.__app.lastPhotoSize` 노출.

- [ ] **Step 1: 실패 e2e** — 사진찍기 탭 → 1초 내 `__app.lastPhotoSize > 20000`; 캡처 캔버스 좌하단 픽셀 샘플이 순백에 가까움(워터마크).
- [ ] **Step 2~4** · **Step 5: `docs/learn/14-…md`** · **Step 6: Commit** `feat: 사진찍기` + 동기화

---

### Task 15: 자동 품질 조정 · 저장 불가 안내 · 폰 체크리스트

**Files:**
- Create: `src/state/quality.js`, `tests/unit/quality.test.js`, `tests/e2e/resilience.spec.mjs`, `docs/checklist-phone.md`, `docs/learn/15-품질과-오류.md`
- Modify: `src/app.js`, `src/scene/sky.js`(setShadows), `src/scene/water.js`(setSegments)

**Interfaces:**
- Produces: `class FpsMeter { push(dt); average(): number; samples: number }`, `decideQuality(avgFps): 'high'|'low'`(30 미만이면 low). app: 첫 3초(180 프레임 또는 3초) 뒤 한 번만 판단, low면 `sky.setShadows(false)`·`water.setSegments(35)`·토스트 "부드럽게 보이도록 그래픽을 낮췄어요". `storage.isPersistent===false`면 진입 직후 토스트 "이번엔 저장이 안 돼요".

- [ ] **Step 1: 실패 테스트** — unit: `decideQuality(29.9)==='low'`, `(30)==='high'`; FpsMeter 평균. e2e: `addInitScript`로 `localStorage.setItem`이 throw 하게 만든 뒤 진입 → 토스트 "이번엔 저장이 안 돼요"; `__app.forceQuality('low')` 후 `__app.water.segments===35`.
- [ ] **Step 2~4** · **Step 5: `docs/checklist-phone.md`**(폰 확인 5항목: 진입·걷기·석양멍·병 띄우기·사진) **+ `docs/learn/15-…md`** · **Step 6: Commit** `feat: 자동 품질 조정과 복원력` + 동기화

---

### Task 16: 배포 준비 · 미리보기 · 전체 검증

**Files:**
- Create: `docs/deploy.md`, `.nojekyll`, `README.md`, `scripts/build-artifact.mjs`
- Modify: 없음(코드 변경 없이 검증만)

- [ ] **Step 1: 전체 테스트** — Run: `npm run test:unit && npx playwright test` Expected: 모두 PASS. 폰(390×844)·PC(1280×800) 스크린샷을 `tests/e2e/__shots__/`에 남기고 Read로 UI 겹침·잘림 확인.
- [ ] **Step 2: 아티팩트 미리보기 빌드** — `scripts/build-artifact.mjs`: `index.html`에서 `<!doctype>`, `<html>`, `<head>`, `<body>` 태그를 벗겨 `dist-artifact/index.html`을 만들고 `src/`, `styles.css`, `vendor/`를 그대로 복사. Artifact 도구로 `dist-artifact/index.html`을 `files`와 함께 게시해 폰 미리보기 링크 제공. (아티팩트 환경에서 모듈 로드가 막히면 이 단계는 건너뛰고 GitHub Pages로만 확인 — 결과를 기록.)
- [ ] **Step 3: `docs/deploy.md` 작성** — GitHub 가입 → 저장소 `sunset-resort` 생성(Public) → GitHub Desktop 설치 → `Future/sunset-resort` 폴더를 "Add local repository" → 첫 Commit·Publish → 저장소 Settings › Pages › Branch `main` / root → 주소 확인. 각 단계는 Claude가 내장 브라우저로 화면을 열고 사용자가 클릭한다고 명시.
- [ ] **Step 4: `README.md`**(앱 소개, 폴더 구조, 테스트 실행법, `docs/learn/` 안내) · **Step 5: Commit** `docs: 배포 절차·README` + 전체 동기화 · 사용자에게 체크리스트와 함께 알림.
