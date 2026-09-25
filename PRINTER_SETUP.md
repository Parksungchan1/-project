# 다른 컴퓨터에서 프린터만 새로 연결하기 (admin-client)

백엔드/프론트엔드는 이미 Railway에 배포되어 계속 돌고 있습니다. **새 장소에 프린터를 놓고
그 프린터만 연결**하려는 경우(예: 다른 지역에서 admin-client를 새로 띄우는 경우) 백엔드나
프론트엔드를 다시 배포할 필요가 전혀 없습니다 — 아래 절차대로 **admin-client만** 그
컴퓨터에서 새로 실행하면 됩니다.

## 먼저 짚고 갈 것: "서버"는 이미 클라우드에 떠 있음

- **백엔드 서버**(`packages/server`)는 Railway에서 24시간 이미 돌아가는 중입니다
  (`https://festival-nfcserver-production.up.railway.app`). 이 컴퓨터에서 서버를 열 필요 없음.
- 이 컴퓨터가 할 일은 딱 하나, **admin-client 실행**뿐입니다: 그 백엔드의 출력 큐를 폴링해서
  옆에 연결된 프린터로 Bluetooth 전송.
- Windows / macOS 어디서든 코드 동일 (프린터 장치 경로 표기법만 다름 — `RAILWAY_DEPLOY.md`,
  `README.md`의 "admin-client를 macOS에서 실행하기" 참고)

## 절차

1. Node.js 설치 확인 (`node -v`, 18 이상)
2. 저장소 클론 + 준비
   ```bash
   git clone https://github.com/Parksungchan1/-project.git
   cd -project
   npm install
   npm run build --workspace packages/shared
   ```
3. `packages/admin-client/.env.example`을 복사해서 `.env`로 만들고 채우기:
   ```
   SERVER_URL=https://festival-nfcserver-production.up.railway.app
   ADMIN_TOKEN=<Railway 서버 Variables에 설정된 값과 반드시 동일하게>
   PRINTER_COM_PORT=<5번에서 확인한 값으로 나중에 채움>
   POLL_INTERVAL_MS=2000
   DRY_RUN=true
   ```
4. 프린터를 이 컴퓨터의 OS 블루투스 설정에서 페어링
   - Windows: 설정 → 블루투스 및 장치 → 장치 추가
   - macOS: 시스템 설정 → Bluetooth
5. 페어링된 프린터의 장치 경로 확인
   - Windows: 블루투스 설정 → "추가 블루투스 옵션" → COM 포트 탭
   - macOS(또는 공통): `packages/admin-client`에서 `npm run list-ports` 실행 →
     출력된 목록에서 프린터에 해당하는 경로 확인
6. 3번의 `.env`에서 `PRINTER_COM_PORT`를 5번에서 확인한 값으로 채움
7. `npm run dev:admin` 실행 → 콘솔에
   `admin-client polling https://festival-nfcserver-production.up.railway.app every 2000ms`,
   `printer expected at <경로>` 로그가 뜨는지 확인 (SERVER_URL이 Railway 주소인지, 실수로
   localhost가 아닌지 여기서 확인)
8. `DRY_RUN=true` 상태에서 폰으로 아무 아티스트나 골라 "출력하기" → 콘솔에
   `[DRY_RUN] would send ...` 로그가 뜨면 신호 경로(서버↔admin-client)는 정상
9. 실제 출력 확인할 준비가 되면 `.env`에서 `DRY_RUN=false`로 바꾸고 admin-client 재시작
   (Ctrl+C 후 다시 `npm run dev:admin`) → 다시 출력 시도 → 실제 종이 나오면 완료

## 주의사항

- **`ADMIN_TOKEN`은 Railway 백엔드 Variables에 설정된 값과 반드시 동일**해야 인증이 통과함.
  이 값은 저장소에 없으므로(gitignore) 기존 운영자에게 직접 전달받아야 함.
- **admin-client는 한 번에 한 곳에서만 실행**할 것. 같은 백엔드를 보는 admin-client가
  두 컴퓨터에서 동시에 뜨면 같은 출력 큐를 두고 경쟁하게 되어 job이 엉뚱한 쪽으로 몰리거나
  둘 다 응답이 늦어질 수 있음 — 새 컴퓨터에서 켜기 전에 기존 컴퓨터의 admin-client는 꺼둘 것.
- 이 백엔드를 계속 쓸 경우 Railway 무료 트라이얼(23일 또는 $5 크레딧) 만료 관련 주의사항은
  [`RAILWAY_DEPLOY.md`](./RAILWAY_DEPLOY.md) 4번 참고.
- 백엔드/프론트엔드까지 통째로 **자기 계정으로 새로 배포**하고 싶다면(완전히 별도 서버를
  운영하고 싶은 경우) 이 문서가 아니라 [`RAILWAY_DEPLOY.md`](./RAILWAY_DEPLOY.md)를 따를 것.
