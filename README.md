# Sunset Resort

몰디브풍 해변에서 석양을 바라보며 칵테일 한 잔 — 브라우저로 여는 3D 힐링 웹앱입니다. 아이폰·안드로이드·PC 모두 링크 하나로 열립니다.

현재는 **A단계(혼자 쓰는 버전)** 입니다: 닉네임·꾸미기, 해변 걷기, 놀기(인사·건배·춤·눕기·비치볼), 석양멍(파도 소리), 오늘의 칵테일(하루 5잔), 매일 오후 7시 석양 이벤트, 유리병 편지(폰에 저장), 사진찍기. 다음은 B단계(편지를 서버에 저장하고 링크로 친구와 공유), C단계(같은 해변의 사람들이 실시간으로 보임)입니다.

## 폴더 구조
- `index.html` · `styles.css` — 화면의 뼈대와 모양
- `src/main.js` — 출발점, `src/app.js` — 모든 것을 조립하고 모드를 바꾸는 곳
- `src/scene/` — 3D 장면(하늘·바다·모래·소품·카메라·유리병·이펙트)
- `src/character/` — 캐릭터 조립·동작·이동
- `src/ui/` — 화면 UI(진입·HUD·패널·조이스틱·석양멍·사진)
- `src/state/` — 화면 없는 규칙과 저장(닉네임·날짜·무드·병·품질)
- `src/audio/` — 파도 소리 합성
- `vendor/three/` — 3D 라이브러리 three.js 0.170.0 복사본
- `tests/unit/` · `tests/e2e/` — 자동 테스트
- `docs/learn/` — **각 기능을 어떻게 만들었는지 한국어 설명(01~16)** ← 공부는 여기서부터
- `docs/deploy.md` — 폰에서 열리는 주소 만드는 법, `docs/checklist-phone.md` — 폰 확인 5가지
- `docs/superpowers/` — 설계 문서와 구현 계획

## 직접 돌려보기 (선택)
```
npm install                 # 테스트 도구 설치 (처음 한 번)
npm run serve               # http://127.0.0.1:4173 에서 열기
npm run test:unit           # 규칙 테스트
npx playwright test         # 브라우저 테스트 (Playwright 크로미움 필요)
```
