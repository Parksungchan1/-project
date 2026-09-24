# Festival NFC Artist App — 구조

npm workspaces 모노레포. 3개 패키지:

- `packages/shared` — 서버·관리자클라이언트가 공유하는 타입 (`Artist`, `PrintJob` 등)
- `packages/server` — 사용자 웹앱이 호출하는 API 서버 (Express + TS). 클라우드에 배포.
- `packages/admin-client` — 부스 랩탑에서 상시 실행. 서버의 출력 큐를 폴링하고, T02 프린터에 블루투스(COM 포트)로 전송.

사용자 웹앱 UI는 별도 저장소(`https://github.com/Jun11561/SH_PT`, "wavelog", `packages/shared`의 `Artist`/`Song` 타입에 맞춰 연동됨). 이 저장소는 그 UI가 호출할 API와, 프린터로 가는 백엔드 경로만 다룹니다.

## 개발 준비

```bash
npm install
npm run build --workspace packages/shared   # server/admin-client가 이 타입을 참조하므로 먼저 빌드
cp packages/server/.env.example packages/server/.env
cp packages/admin-client/.env.example packages/admin-client/.env
```

서버 실행:

```bash
npm run dev:server
```

관리자 클라이언트 실행 (프린터가 Windows에 블루투스로 페어링되어 COM 포트가 배정된 상태여야 함):

```bash
npm run dev:admin
```

## 아직 손대야 할 부분

1. **결과지(출력물) 이미지** — 9명 고정이라 결과지도 9종류로 고정. `packages/server/assets/results/<artistId>.png`에 완성된 디자인 파일(384px 폭)을 넣으면 서버가 그걸 그대로 큐에 태움. 아직 파일이 없어서 `resultImage.ts`가 화면상 영수증(`Receipt.tsx`)과 같은 레이아웃을 캔버스로 자동 생성해 대체 중 — 실기기 인쇄까지 검증됨(README 하단 참고). 손으로 디자인한 PNG를 넣으면 이걸 대체.
2. **한글 폰트** — 위 1번의 자동생성 대체 경로에 한글이 들어가는데, 클라우드 리눅스 서버엔 한글 폰트가 기본 설치되어 있지 않을 수 있음. `packages/server/assets/fonts/korean.ttf`에 폰트 파일(예: Noto Sans KR)을 넣으면 자동 등록됨(gitignore됨 — 라이선스 문제로 커밋 안 함, 로컬엔 Malgun Gothic으로 채워둔 상태). 손으로 디자인한 PNG로 교체하면 이 문제 자체가 사라짐.
3. **배포** — 서버를 어느 클라우드(예: Railway, Render, Fly.io 등)에 올릴지 아직 미정.
4. **인증 토큰** — `ADMIN_TOKEN`을 서버와 admin-client 양쪽 `.env`에 동일하게 설정해야 관리자 API(큐 꺼내기 등)가 동작함.

**아티스트 데이터/이미지, 오디오, 프린터 프로토콜 검증은 완료됨.** 오디오는 mp3 파일이 아니라 `Artist.youtubeVideoId`(각 곡의 YouTube 공식 업로드)를 화면에 안 보이게 임베드해서 재생 — 저작권 있는 실제 음원이라 자체 파일로 호스팅하지 않기로 함. 프린터는 아래 "프린터 연결하면 바로 동작하나?" 참고.

## API 요약

| Method | Path | 설명 |
|---|---|---|
| POST | /api/session | 세션 발급 |
| GET | /api/artists | 카드용 9명 목록 |
| GET | /api/artists/:id | 상세 + 유사 아티스트 |
| POST | /api/print-jobs | 출력 요청 (해당 아티스트의 사전 준비된 결과 이미지를 큐에 적재) |
| POST | /api/print-jobs/dequeue | (관리자, admin-client 전용) 다음 작업 꺼내기 — 호출될 때마다 heartbeat 기록됨 |
| POST | /api/print-jobs/:id/complete | (관리자) 완료 처리 |
| POST | /api/print-jobs/:id/fail | (관리자) 실패 처리 |
| POST | /api/print-jobs/:id/retry | (관리자) 실패한 작업을 큐에 다시 넣음 (admin.html의 "다시 시도" 버튼) |
| GET | /api/print-jobs | (관리자) 최근 작업 목록 + admin-client 마지막 접속 시각 (admin.html이 폴링) |

## 테스트/모니터링 페이지

- `/test.html` — 사용자앱 신호 시뮬레이터 (실제 UI 아님, NFC 태그 테스트용)
- `/admin.html?token=<ADMIN_TOKEN>` — 관리자 모니터. 이 URL을 부스 랩탑 브라우저에 북마크해두면 토큰을 다시 입력할 필요 없음. 1.5초마다 자동 새로고침:
  - 프린터 연결 프로그램(admin-client) 생존 여부를 색으로 표시 (5초 이상 응답 없으면 빨간색 경고)
  - 최근 요청/상태 로그
  - 실패한 작업에 "다시 시도" 버튼 — 누르면 admin-client의 정상 자동 루프로 다시 들어감 (관리자가 직접 출력을 트리거하는 게 아님)

## 프린터 연결하면 바로 동작하나?

**신호 배관(서버 ↔ 관리자 자동 폴링 ↔ 완료 처리)은 검증 완료.** 실제 T02로 테스트하면 이 부분은 그대로 동작할 것으로 예상.

**단, 프린터 프로토콜 바이트는 미검증**입니다 (`printerProtocol.ts`, `bluetoothPrinter.ts`) — vivier/phomemo-tools 문서 기준 추정치이고, 실기기로 테스트한 적이 없습니다. 실제로 연결했을 때:
1. Windows Bluetooth 설정에서 T02를 페어링하고 배정된 COM 포트 확인 (`PRINTER_COM_PORT`에 설정)
2. `.env`에서 `DRY_RUN=false`로 변경
3. 출력 시도 — 아무것도 안 나오거나 깨진 패턴이 나올 수 있음. 이 경우 명령 바이트(초기화/정렬/래스터 헤더)를 실기기 응답 보면서 같이 맞춰야 함
4. T02가 Classic Bluetooth(SPP)가 아니라 BLE라면 `bluetoothPrinter.ts`(COM 포트 기반) 자체를 Web Bluetooth나 Android BLE API 기반으로 다시 짜야 함 — 페어링 시 COM 포트가 배정되는지 여부로 판별 가능

즉 "신호가 오가고 관리자가 인지하는 부분"은 되지만, "실제로 종이에 정확히 인쇄되는 것"은 프린터 받으신 후 같이 디버깅이 필요합니다.
