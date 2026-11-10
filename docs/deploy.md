# 배포 절차 — 폰에서 열리는 진짜 주소 만들기 (GitHub Pages, 무료)

한 번만 설정하면, 그 뒤로는 "Commit → Push" 두 번 클릭으로 새 버전이 1~2분 뒤 폰에 반영됩니다. 각 단계는 Claude가 내장 브라우저로 화면을 열어 두고, 클릭·입력은 세민님이 직접 합니다(계정 비밀번호는 Claude가 입력하지 않습니다).

## 지금 주소
- https://citytoure42.github.io/sunset-resort/ (저장소: github.com/CityToure42/sunset-resort, 2026-11-06 공개)

## 처음 한 번
1. **GitHub 가입** — github.com에서 무료 계정 만들기. 아이디가 주소에 들어갑니다(예: `semin97`).
2. **GitHub Desktop 설치** — desktop.github.com에서 맥용 설치 후 GitHub 계정으로 로그인.
3. **폴더를 저장소로 등록** — GitHub Desktop › File › Add Local Repository › `Desktop/이세민/Future/sunset-resort` 선택. "이 폴더는 저장소가 아니에요"라고 나오면 "create a repository" 클릭(이름 `sunset-resort`, 나머지 기본값).
4. **첫 커밋·공개** — 왼쪽 아래 Summary에 `첫 버전` 입력 → Commit to main → 위쪽 "Publish repository". 이때 **"Keep this code private" 체크를 해제**(무료 GitHub Pages는 공개 저장소에서 동작).
5. **Pages 켜기** — 브라우저에서 저장소 페이지 › Settings › Pages › Source: "Deploy from a branch", Branch: `main`, 폴더 `/ (root)` › Save.
6. **주소 확인** — 1~2분 뒤 같은 화면 위쪽에 `https://아이디.github.io/sunset-resort/`가 뜹니다. 폰 사파리·크롬으로 열고 "홈 화면에 추가"하면 앱처럼 아이콘이 생깁니다.

## 그 다음부터 (업데이트할 때마다)
1. Claude가 코드를 `Future/sunset-resort`에 저장하면 GitHub Desktop 왼쪽에 바뀐 파일이 보입니다.
2. Summary 한 줄 → **Commit to main** → **Push origin**.
3. 1~2분 뒤 GitHub에 반영되지만, **폰 브라우저는 예전 파일을 최대 10분 기억(캐시)** 합니다. 푸시 후 10분쯤 지나서 새로고침하세요. 급하면 주소 뒤에 `?v=아무숫자`를 붙여 열면 첫 화면은 새로 받습니다(다른 파일은 여전히 캐시될 수 있음).
4. `docs/checklist-phone.md`의 5가지를 확인.

## 알아둘 것
- 저장소가 공개이므로 코드는 누구나 볼 수 있습니다(비밀번호·키 같은 건 이 앱에 없음. B단계의 Supabase "공개 키"는 원래 공개용이라 괜찮고, 관리자 키는 절대 넣지 않습니다).
- `.nojekyll` 파일은 GitHub Pages가 폴더를 그대로 올리게 하는 표시입니다. 지우지 마세요.
- `node_modules/`, `test-results/`, `dist-artifact/`는 `.gitignore`에 있어 올라가지 않습니다.

## B단계: 서버(Supabase) 관리

- 프로젝트: Supabase `sunset-resort` (서울 리전, 무료), 대시보드 주소 `https://supabase.com/dashboard/project/xrydrdeyaycijtxulgyw`
- 앱 코드에는 **공개 키(publishable)** 만 들어 있어요. 관리자 키(secret)와 DB 비밀번호는 코드·문서 어디에도 넣지 않습니다.

### 서버 규칙 적용(처음 한 번, 규칙을 바꿀 때마다)
1. 대시보드 › **SQL Editor** › New query
2. `supabase/migrations/001_b_stage.sql` 내용을 통째로 붙여 넣고 **Run**
3. 아래 결과 칸에 성공(Success) 표시가 나오고 빨간 오류가 없으면 끝. 같은 파일을 두 번 실행해도 안전해요(테스트로 확인).
4. **순서 주의**: 서버 규칙을 먼저 적용하고, 그다음에 앱을 Push 하세요. 반대로 하면 그 사이 앱이 "바다 소식을 불러오지 못했어요"를 띄워요.

### 이상한 병 지우기(관리자 삭제)
1. 대시보드 › **Table Editor** › `bottles`
2. 지울 병의 줄을 찾아(메시지·닉네임으로 확인) 왼쪽 체크 › **Delete** › 확인
3. 그 병의 답글·좋아요·신고 기록은 자동으로 함께 지워져요(`on delete cascade`).

### 잘못 숨겨진 병 되살리기(신고 수 0으로)
1. Table Editor › `bottles` › 그 병의 `reports` 칸을 `0`으로 고치고 Save
2. `reports` 표에서 그 병의 줄들도 지우면 같은 사람이 다시 신고할 수 있어요(안 지우면 같은 기기는 다시 신고 못 함).
3. 내가 신고해서 내 폰에서만 숨긴 병은 폰에 기억돼 있어서 서버에서 되살려도 내 바다에는 안 떠요(앱 데이터 지우면 다시 보여요).

### 서버가 잠들었을 때
- 무료 프로젝트는 **7일간 요청이 없으면 일시 정지**돼요. `.github/workflows/keepalive.yml`이 매일 KST 09:17에 한 번 깨워요.
- 그래도 멈췄다면 대시보드에서 **Restore project**(복구) 버튼을 누르면 돼요. 복구에는 몇 분 걸릴 수 있어요.
- GitHub의 예약 작업은 저장소에 60일 동안 변경이 없으면 꺼질 수 있어요. 그땐 GitHub › Actions › keepalive › **Enable workflow**.

## C단계: 같은 해변(실시간) 관리

- 같은 Supabase 프로젝트의 **Realtime** 기능을 써요. 채널 이름은 `beach`(공개 채널) 하나예요. 따로 표나 SQL은 없어요.
- 대시보드의 Realtime 설정(Realtime Settings)에서 **"Allow public access"가 켜져 있어야** 해요(기본값). 끄면 공개 채널을 못 써서 모두 "연결이 끊겼어요"가 떠요.
- 채팅 말풍선은 저장되지 않으므로 지우거나 관리할 것이 없어요.
- **사용량 확인:** 대시보드의 Usage(사용량) 화면에서 Realtime 메시지 수를 봐요. 무료 한도는 한 달 200만 개, 동시 접속 200명이에요.
  메시지는 "받는 사람 수"로 세서, 사람이 늘수록 빨리 늘어요. 한도를 넘으면 이메일 알림과 유예 기간이 있어요.
  자주 넘으면 위치 보내기 간격(`MOVE_INTERVAL_MS`, 지금 0.5초)을 늘리는 걸 검토해요.
- 실시간 라이브러리는 `vendor/supabase/supabase.js`(supabase-js 2.118.0 복사본)예요. 업데이트할 때는 새 버전 파일로 바꾸고 전체 테스트를 돌려요.
