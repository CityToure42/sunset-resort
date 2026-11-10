# Sunset Resort

몰디브풍 해변에서 석양을 바라보며 칵테일 한 잔 — 브라우저로 여는 3D 힐링 웹앱입니다. 아이폰·안드로이드·PC 모두 링크 하나로 열립니다.

지금은 **C단계(같은 해변)** 까지 되어 있어요.

- **A단계(혼자 쓰는 버전)**: 닉네임·꾸미기, 해변 걷기, 놀기(인사·건배·춤·눕기·비치볼), 석양멍(파도 소리), 오늘의 칵테일(하루 5잔), 매일 오후 7시 석양 이벤트, 사진찍기
- **B단계(모두의 바다)**: 유리병 편지가 서버(Supabase)에 저장되어 **링크를 연 모든 사람의 바다에 함께** 떠요.
  - 병을 탭하면 편지 카드가 열리고 ♥·답글·신고를 할 수 있어요.
  - 공유 링크(`#b=병id`)로 열면 그 병 앞바다에서 바로 카드가 열려요.
  - 메시지 보기에서 내 편지에 온 ♥·답글을 보고, 새 답글이 오면 탭에 빨간 점이 떠요.
  - 다른 기기 3곳에서 신고하면 자동으로 숨겨져요. 관리자 삭제 방법은 `docs/deploy.md`에 있어요.
- **C단계(같은 해변)**: 같은 주소로 들어온 사람들이 한 해변에서 서로 보여요.
  - 친구 캐릭터가 꾸민 모습과 닉네임표 그대로 걷고, 놀기 동작·칵테일·석양멍까지 실시간으로 보여요.
  - 💬로 30자 말풍선을 5초 동안 띄울 수 있어요(저장 안 됨).
  - 왼쪽 위에 "지금 n명이 함께 있어요", 끊기면 "연결이 끊겼어요 · 다시 연결 중" 후 자동으로 다시 붙어요.

## 폴더 구조
- `index.html` · `styles.css` — 화면의 뼈대와 모양
- `src/main.js` — 출발점, `src/app.js` — 모든 것을 조립하고 모드를 바꾸는 곳
- `src/scene/` — 3D 장면(하늘·바다·모래·소품·카메라·유리병·이펙트)
- `src/character/` — 캐릭터 조립·동작·이동
- `src/ui/` — 화면 UI(진입·HUD·패널·조이스틱·석양멍·사진)
- `src/state/` — 화면 없는 규칙과 저장(닉네임·날짜·무드·병·품질, 서버 병 저장소 `remoteBottles.js`)
- `src/net/` — 서버(Supabase)와 대화하는 코드(`api.js`: 편지, `realtime.js`: 실시간)와 주소·공개 키(`config.js`)
- `src/features/` — 여러 파일에 걸친 기능 묶음(`bottles.js`: 유리병 편지 전체, `people.js`: 같은 해변의 다른 사람들)
- `supabase/migrations/` — 서버 DB 규칙(SQL). Supabase SQL 편집기에 붙여 넣어 적용
- `src/audio/` — 파도 소리 합성
- `vendor/three/` — 3D 라이브러리 three.js 0.170.0 복사본
- `vendor/supabase/` — 실시간 라이브러리 supabase-js 2.118.0 복사본(C단계)
- `tests/unit/` · `tests/e2e/` · `tests/sql/` — 자동 테스트(브라우저 테스트는 가짜 서버 `fake-supabase.mjs`를 씀)
- `.github/workflows/keepalive.yml` — 무료 서버가 잠들지 않게 매일 한 번 깨우기
- `docs/learn/` — **각 기능을 어떻게 만들었는지 한국어 설명(01~29)** ← 공부는 여기서부터
- `docs/deploy.md` — 폰에서 열리는 주소 만드는 법, `docs/checklist-phone.md` — 폰 확인 5가지
- `docs/superpowers/` — 설계 문서와 구현 계획

## 직접 돌려보기 (선택)
```
npm install                 # 테스트 도구 설치 (처음 한 번)
npm run serve               # http://127.0.0.1:4173 에서 열기
npm run test:unit           # 규칙 테스트
npx playwright test         # 브라우저 테스트 (Playwright 크로미움 필요)
npm run test:sql            # 서버 규칙 테스트 (PostgreSQL 16 필요)
```
