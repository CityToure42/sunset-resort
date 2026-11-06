# 배포 절차 — 폰에서 열리는 진짜 주소 만들기 (GitHub Pages, 무료)

한 번만 설정하면, 그 뒤로는 "Commit → Push" 두 번 클릭으로 새 버전이 1~2분 뒤 폰에 반영됩니다. 각 단계는 Claude가 내장 브라우저로 화면을 열어 두고, 클릭·입력은 세민님이 직접 합니다(계정 비밀번호는 Claude가 입력하지 않습니다).

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
3. 1~2분 뒤 폰에서 새로고침. `docs/checklist-phone.md`의 5가지를 확인.

## 알아둘 것
- 저장소가 공개이므로 코드는 누구나 볼 수 있습니다(비밀번호·키 같은 건 이 앱에 없음. B단계의 Supabase "공개 키"는 원래 공개용이라 괜찮고, 관리자 키는 절대 넣지 않습니다).
- `.nojekyll` 파일은 GitHub Pages가 폴더를 그대로 올리게 하는 표시입니다. 지우지 마세요.
- `node_modules/`, `test-results/`, `dist-artifact/`는 `.gitignore`에 있어 올라가지 않습니다.
