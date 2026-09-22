# Festival NFC Artist App — 세션 인수인계 메모

이 파일은 Claude Code가 세션마다 자동으로 읽는다. 다른 컴퓨터(예: 노트북)에서
새 Claude 세션이 열려도 이 파일 하나로 지금까지 흐름을 바로 파악할 수 있도록 적어둔다.
저장소 구조/API 개요는 `README.md` 참고.

## 지금 뭘 하고 있었나 (2026-09-22)

목표: **NFC 태그 → 웹 → Phomemo T02 블루투스 프린터로 실물 인쇄**가 되는지 실기기로 테스트하는 것.
샘플 결과지 디자인은 이미 하나 만들어져 있고(사용자 확인), 이제 "프린터 연결 자체가 되는지"부터 확인하려는 단계.

**데스크탑(이 저장소를 원래 세팅했던 PC, 메인보드 H510)에는 블루투스 어댑터가 아예 없다** —
확인해보니 시스템에 Bluetooth 장치 자체가 안 잡힘 (USB 동글도 없음). 그래서 **노트북으로 옮겨서
테스트하는 중.** 노트북에도 내장 블루투스가 있다는 전제.

## 직전 세션에서 고친 것 / 추가한 것

1. **`.env` 로딩이 통째로 안 되고 있었음 (버그, 수정 완료)**
   `packages/server`, `packages/admin-client` 둘 다 `.env`를 읽는 코드(dotenv 등)가
   전혀 없어서 `.env` 파일을 만들어도 전부 무시되고 기본값만 적용되고 있었다.
   `package.json`의 `dev`/`start` 스크립트에 Node 내장 `--env-file=.env` 옵션을 추가해서 고침
   (Node 20.6+ 내장 기능, 패키지 설치 필요 없음). 새 `.env`를 만들 때 이 점 신경 안 써도 됨 —
   이제 자동으로 읽힌다.

2. **프린터 연결 확인용 "테스트 인쇄" 버튼 추가**
   `/admin.html`에 `🖨 테스트 인쇄 ("안녕")` 버튼. 누르면 관리자 전용 엔드포인트
   `POST /api/print-jobs/test-print` 호출 → 서버가 "안녕" 텍스트를 이미지로 렌더링해서
   **진짜 아티스트 결과지와 완전히 같은 큐/경로**로 흘려보냄 (admin-client가 폴링해서 그대로 인쇄).
   별도 우회 경로가 아니라 실제 인쇄 파이프라인 자체를 검증하는 용도.
   - 라우트: `packages/server/src/routes/printJobs.ts` (`test-print`)
   - 렌더링: `packages/server/src/services/resultImage.ts` (`renderTextImage`)
   - NFC 태그나 세션 없이도 관리자 토큰만 있으면 바로 테스트 가능하게 만든 것 — 그래서
     블루투스 페어링 확인이 급한 지금 상황에 씀.

3. **한글 폰트 없어서 "안녕"이 빈 네모(tofu)로 찍히던 버그 발견 + 로컬 한정 수정**
   `packages/server/assets/fonts/korean.ttf`가 원래 저장소에 없었다 (README에 이미 TODO로
   적혀 있던 항목). 이 데스크탑의 `C:\Windows\Fonts\malgun.ttf`를 그 경로에 복사해서
   로컬에서는 정상 렌더링되는 것까지 확인함.
   - ⚠️ **이 폰트 파일은 커밋 안 함.** Windows 번들 폰트라 재배포 라이선스 문제가 있어서
     `.gitignore`에 `packages/server/assets/fonts/`를 추가해뒀다. 그래서 **새로 클론한
     컴퓨터에는 이 폴더가 비어있는 게 정상** — 아래 절차대로 폰트를 다시 넣어야 한글이 나온다.
   - 클라우드 배포용으로는 Noto Sans KR 같은 오픈라이선스 폰트로 같은 경로에 넣어야 함
     (Malgun Gothic을 배포물에 넣으면 안 됨).

## 🚦 노트북(새 컴퓨터)에서 이어서 할 절차

1. `git clone https://github.com/Parksungchan1/-project.git` (이미 있으면 `git pull`)
2. `npm install`
3. `npm run build --workspace packages/shared` (server/admin-client가 이 타입을 참조하므로 먼저)
4. **`.env` 2개를 새로 만든다** (저장소에 없음 — gitignore됨, 의도적):
   - `packages/server/.env`:
     ```
     PORT=3000
     ADMIN_TOKEN=<아무 랜덤 문자열, 예: openssl rand -hex 12 결과>
     ```
   - `packages/admin-client/.env`:
     ```
     SERVER_URL=http://localhost:3000
     ADMIN_TOKEN=<서버 .env와 반드시 같은 값>
     PRINTER_COM_PORT=COM5
     POLL_INTERVAL_MS=2000
     DRY_RUN=true
     ```
     (`DRY_RUN=true`면 프린터 없이 신호 경로만 확인. 페어링 끝나면 `false`로 바꾼다.)
5. **한글 폰트 채워넣기**: 한글이 지원되는 `.ttf` 파일을 복사해서
   `packages/server/assets/fonts/korean.ttf` 로 저장 (Windows면 `C:\Windows\Fonts\malgun.ttf`,
   없으면 Noto Sans KR 다운받아 사용). 이거 없으면 "안녕"이 빈 네모로 찍힌다.
6. 터미널 1: `npm run dev:server` — 뜨면 `http://localhost:3000/test.html`,
   `http://localhost:3000/admin.html?token=<ADMIN_TOKEN>` 접속 확인.
7. **T02를 블루투스로 페어링**: Windows 설정 → 블루투스 및 장치 → 장치 추가 → T02 선택 → 페어링
   → 설정 → 블루투스 → "추가 블루투스 옵션" → COM 포트 탭에서 배정된 포트 이름 확인.
8. `packages/admin-client/.env`의 `PRINTER_COM_PORT`를 7번에서 확인한 값으로 바꾸고
   `DRY_RUN=false`로 변경.
9. 터미널 2: `npm run dev:admin`
10. `/admin.html?token=...` 열어서 **"🖨 테스트 인쇄 ("안녕")" 버튼 클릭**.
    실제로 "안녕"이 인쇄되면 성공. 안 나오거나 깨지면 `packages/admin-client/src/printerProtocol.ts`의
    명령 바이트가 문서(vivier/phomemo-tools) 기반 추정치라서 그런 것 — 실기기 반응 보면서
    같이 튜닝해야 함(README의 "아직 손대야 할 부분" 5번 참고).
11. **NFC 태그 테스트**: `ipconfig`로 노트북의 LAN IP 확인 → 폰이 노트북과 같은 와이파이에
    있어야 함 → "NFC Tools" 같은 앱으로 `http://<노트북IP>:3000/test.html` URL을 빈 NFC 태그에
    기록 → 폰으로 태깅해서 그 페이지가 뜨면 성공. (`/test.html`은 신호 확인용 가짜 화면이고,
    실제 사용자 웹앱 UI는 이 저장소와 별개로 진행 중 — README 참고.)

## 잔여 설계 메모 (혼동 방지용)

- `writeEndpointLimiter`(rate limit)는 사용자용 `/session`, `/print-jobs`에만 걸려있고
  관리자용 `/print-jobs/test-print`에는 안 걸려있다 — admin 토큰으로만 보호되는 게 의도된 설계.
- `/print-jobs`는 세션당 멱등(같은 sessionId로 또 호출하면 기존 job 반환)이지만,
  `test-print`는 버튼 누를 때마다 새 세션ID를 만들어서 매번 새 job이 생긴다 — 반복 테스트
  용도라 의도한 동작.
