# Railway 배포 절차

이 문서는 2026-09-24에 실제로 Railway에 배포했던 과정을 그대로 정리한 메모입니다.
다른 계정으로 새로 배포할 때 그대로 따라 하면 됩니다.

이 저장소(백엔드: `packages/server`)와 프론트엔드(`https://github.com/Parksungchan1/SH_PT`,
"wavelog")는 **별도 저장소라 Railway에도 별도 서비스 2개**로 올립니다.
`packages/admin-client`는 부스 노트북에서만 로컬로 돌아가야 하는 프로그램이라
**절대 클라우드에 올리지 않습니다** (블루투스/COM 포트로 실제 프린터에 접근해야 함).

## 0. 사전 준비

- Railway 계정 (GitHub 로그인으로 가입 가능, 신용카드 없이 트라이얼 시작 가능)
- 배포하려는 백엔드/프론트엔드 저장소가 **본인 GitHub 계정**에 있어야 함
  (fork 또는 이 저장소 그대로 clone 후 자기 계정으로 push)

## 1. 백엔드 배포 (`packages/server`)

1. https://railway.app 접속 → GitHub 계정으로 로그인
2. **New Project → Deploy from GitHub repo** → 이 백엔드 저장소 선택
   - 처음이면 Railway가 GitHub 앱 권한을 요청함 → 해당 저장소 접근 허용
3. ⚠️ **중요**: Railway가 모노레포를 스캔해서 `admin-client`까지 별도 클라우드 서비스로
   배포하자고 제안하는 경우가 있습니다. **반드시 admin-client 서비스 카드를 지우고
   서버(`packages/server`)만 남기세요.** admin-client가 클라우드에서 돌면 실제 프린터가
   없는 상태로 헛돌면서, 진짜 admin-client(부스 노트북)와 같은 출력 큐를 두고 충돌합니다.
4. 이 저장소 루트의 `railway.json`을 Railway가 자동으로 읽어서 빌드/실행 명령을 씁니다
   (별도 설정 불필요):
   ```json
   {
     "build": { "buildCommand": "npm install && npm run build --workspace packages/shared && npm run build --workspace packages/server" },
     "deploy": { "startCommand": "npm run start --workspace packages/server" }
   }
   ```
5. **환경변수 설정** (서비스 → Variables 탭):
   ```
   ADMIN_TOKEN=<직접 생성한 랜덤 문자열, 예: openssl rand -hex 12>
   ```
   `PORT`은 Railway가 자동으로 주입하므로 따로 설정하지 않습니다.
6. 배포가 끝나면 **Settings → Networking → Generate Domain**으로 공개 URL 발급
   (`https://<서비스명>-production.up.railway.app` 형태)
7. 확인:
   ```bash
   curl https://<발급받은 도메인>/health
   curl https://<발급받은 도메인>/api/artists
   ```
   둘 다 정상 응답하면 완료.

### 배포 중 실제로 만났던 문제

- **`node --env-file=.env`가 Railway의 Node 18에서 지원 안 됨** — 이 플래그는 Node 20.6+ 전용이고,
  애초에 배포 환경엔 `.env` 파일 자체가 없어서(환경변수는 파일이 아니라 직접 주입되는 방식)
  어차피 실패했을 명령입니다. `packages/server/package.json`의 `start` 스크립트에서
  `--env-file` 옵션을 제거해서 해결했습니다 (이미 이 저장소에 반영됨).
- 위 3번(admin-client가 같이 배포되려던 문제)도 실제로 겪었던 문제입니다.

## 2. 프론트엔드(wavelog / SH_PT) 배포

1. Railway 프로젝트로 돌아가서 **New Service → GitHub repo** → SH_PT 저장소 선택
   - 이 저장소는 백엔드와 다른 GitHub 저장소이므로, Railway GitHub App 설정에서
     저장소 접근 권한을 추가해야 목록에 뜰 수 있습니다 (Configure → Repository access).
2. SH_PT엔 `railway.json`이 없어서 Railway(Nixpacks)가 `package.json`을 보고 자동으로
   빌드/실행 명령을 추측합니다. 보통 `npm run build` → `npm run preview -- --host --port $PORT`
   식으로 잡히는데, 자동 추측이 이상하면 서비스 Settings에서 직접 지정하세요:
   - Build: `npm install && npm run build`
   - Start: `npm run preview -- --host 0.0.0.0 --port $PORT`
3. **환경변수** (Variables 탭):
   ```
   VITE_API_BASE_URL=<1번에서 발급받은 백엔드 공개 URL>
   ```
   ⚠️ Vite는 이 값을 **빌드 시점에 번들 안에 그대로 굽습니다.** 그래서 반드시 서비스를
   처음 배포하기 *전에* Variables를 넣어야 합니다. 나중에 값만 바꾸면 재배포(재빌드)를
   한 번 더 트리거해야 반영됩니다.
4. Settings → Networking → Generate Domain으로 공개 URL 발급
5. 확인: 발급받은 URL을 브라우저(가능하면 폰)로 열어서 IntroPage가 뜨는지, 개발자 도구
   Network 탭에서 백엔드로 `fetch`가 성공하는지 확인.

## 3. 부스 노트북(admin-client)을 배포된 백엔드로 연결

로컬에서만 돌리던 `packages/admin-client`가 이제 클라우드 백엔드의 출력 큐를 보도록 바꿔야
실제로 폰에서 누른 "출력하기"가 프린터로 나갑니다.

1. `packages/admin-client/.env` 수정:
   ```
   SERVER_URL=<1번에서 발급받은 백엔드 공개 URL>
   ADMIN_TOKEN=<백엔드 Variables에 넣은 값과 반드시 동일하게>
   PRINTER_COM_PORT=<페어링된 실제 COM 포트>
   DRY_RUN=false
   ```
2. 기존에 로컬(`http://localhost:3000`)을 보던 admin-client 프로세스가 떠 있다면 종료하고
   새 설정으로 다시 `npm run dev:admin` 실행.
3. `/admin.html?token=<ADMIN_TOKEN>`을 배포된 백엔드 도메인으로 열어서 admin-client 하트비트가
   초록색(정상)인지 확인.

## 4. 요금제 관련 주의사항

- Railway 신규 계정은 **트라이얼(무료 체험)** 상태로 시작합니다: **"가입 후 23일" 또는
  "무료 크레딧 $5 소진"** 중 먼저 도달하는 쪽에서 끝납니다.
- 백엔드 + 프론트엔드 두 서비스가 같은 계정 크레딧을 같이 소모하므로, 트래픽에 따라
  23일보다 더 빨리 소진될 수 있습니다.
- 트라이얼이 끝나면 결제 수단을 등록해야 서비스가 계속 돌아갑니다 (안 하면 서비스 중지).
  Hobby 플랜은 월 $5 수준이고 실제로는 사용한 만큼만 과금되므로, 행사 하루이틀만 켜뒀다가
  끄면 청구액은 훨씬 적을 수 있습니다.
- 대안으로 Render처럼 계정당 영구 무료 티어를 제공하는 곳도 있습니다 (단, 15분 비활성 시
  자동 슬립되어 첫 요청에 수십 초 지연이 생길 수 있음 — admin-client가 계속 폴링하면
  실질적으로 슬립되지 않을 가능성이 높습니다).
- ⚠️ 계정을 새로 만들어서 트라이얼을 반복 받는 방식은 이용약관 위반이라 권장하지 않습니다.

## 참고: 원본 배포 URL (Parksungchan1 계정 기준)

- 백엔드: `https://festival-nfcserver-production.up.railway.app`
- 프론트엔드: `https://shpt-production.up.railway.app`

다른 계정으로 새로 배포하면 각자 새로운 도메인이 발급되므로, 위 URL은 그대로 쓰지 말고
자기 배포 결과로 나온 URL을 2번의 `VITE_API_BASE_URL`과 3번의 `SERVER_URL`에 반영하세요.
