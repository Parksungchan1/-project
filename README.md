# Festival NFC Artist App — 구조

npm workspaces 모노레포. 3개 패키지:

- `packages/shared` — 서버·관리자클라이언트가 공유하는 타입 (`Artist`, `PrintJob` 등)
- `packages/server` — 사용자 웹앱이 호출하는 API 서버 (Express + TS). 클라우드에 배포.
- `packages/admin-client` — 부스 랩탑에서 상시 실행. 서버의 출력 큐를 폴링하고, T02 프린터에 블루투스(COM 포트)로 전송.

사용자 웹앱 UI는 별도(직접 작업). 이 저장소는 그 UI가 호출할 API와, 프린터로 가는 백엔드 경로만 다룹니다.

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

1. **아티스트 데이터** — `packages/server/src/data/artists.json`에 샘플 2개만 있음. 실제 9팀 + 유사 아티스트로 채워야 함.
2. **이미지/음원** — `imageUrl`/`audioPreviewUrl`은 자리표시자 경로. 실제 파일이 정해지면 정적 파일로 서빙하거나 CDN에 올리고 경로만 교체. (라이선스 확인 필요 — 대화에서 논의한 부분)
3. **결과지(출력물) 이미지** — 9명 고정이라 결과지도 9종류로 고정. `packages/server/assets/results/<artistId>.png`에 완성된 디자인 파일(384px 폭)을 넣으면 서버가 그걸 그대로 큐에 태움. 아직 파일이 없으면 `resultImage.ts`가 자동 생성한 플레이스홀더로 대체됨 (콘솔에 경고 로그 남음). 매 요청마다 새로 그리지 않고 서버 시작 시 9개를 한 번만 로드해서 재사용.
4. **한글 폰트** — 결과지 플레이스홀더를 자동 생성할 때(위 3번의 대체 경로) 한글이 들어가는데, 클라우드 리눅스 서버엔 한글 폰트가 기본 설치되어 있지 않을 수 있음. `packages/server/assets/fonts/korean.ttf`에 폰트 파일(예: Noto Sans KR)을 넣으면 자동 등록됨. 실제 디자인 PNG를 넣으면 이 문제 자체가 사라짐.
5. **프린터 프로토콜 검증** — `printerProtocol.ts`의 명령 바이트는 Phomemo 계열 리버스엔지니어링 문서(vivier/phomemo-tools) 기준 추정치. 실제 T02 기기로 테스트해서 맞는지 확인 필요. 특히 T02가 Classic Bluetooth(SPP, 현재 구현 전제)인지 BLE인지부터 확인 — `bluetoothPrinter.ts`는 SPP(COM 포트) 전제로 작성됨.
6. **배포** — 서버를 어느 클라우드(예: Railway, Render, Fly.io 등)에 올릴지 아직 미정.
7. **인증 토큰** — `ADMIN_TOKEN`을 서버와 admin-client 양쪽 `.env`에 동일하게 설정해야 관리자 API(큐 꺼내기 등)가 동작함.

## API 요약

| Method | Path | 설명 |
|---|---|---|
| POST | /api/session | 세션 발급 |
| GET | /api/artists | 카드용 9명 목록 |
| GET | /api/artists/:id | 상세 + 유사 아티스트 |
| POST | /api/print-jobs | 출력 요청 (해당 아티스트의 사전 준비된 결과 이미지를 큐에 적재) |
| POST | /api/print-jobs/dequeue | (관리자) 다음 작업 꺼내기 |
| POST | /api/print-jobs/:id/complete | (관리자) 완료 처리 |
| POST | /api/print-jobs/:id/fail | (관리자) 실패 처리 |
