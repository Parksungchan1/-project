# Festival NFC Artist App — 세션 인수인계 메모

이 파일은 Claude Code가 세션마다 자동으로 읽는다. 다른 컴퓨터(예: 노트북)에서
새 Claude 세션이 열려도 이 파일 하나로 지금까지 흐름을 바로 파악할 수 있도록 적어둔다.
저장소 구조/API 개요는 `README.md` 참고.

## ⭐ 최신 상태 (2026-09-25, 오후) — 실기기 인쇄 농도 디버깅 + 이 컴퓨터 admin-client 안정화

Railway 배포(아래 "오전" 섹션) 이후, 다른 지역 친구가 실제로 출력 버튼을 눌러보면서 나온
두 가지 실사용 이슈를 그 자리에서 디버깅함.

1. **"다른 지역 친구가 출력 눌렀는데 프린터가 안 됨" → admin-client가 이 컴퓨터에서 꺼져 있었음.**
   서버(Railway)는 항상 떠 있고, admin-client(이 컴퓨터, 프린터와 COM6로 페어링됨)만 켜면
   됐음. 켜자마자 밀려있던 큐 2건이 바로 인쇄됨 — "서버를 열어야 하는지" 헷갈려했는데, 서버는
   이미 클라우드에 떠 있고 필요한 건 admin-client뿐이라는 구조를 이번에 명확히 함
   (`PRINTER_SETUP.md`가 이 시나리오 문서).

2. **실기기 인쇄가 연하게 나오는 문제 — 여러 단계로 원인을 좁혀감:**
   - 1차 시도(실패): `printerProtocol.ts`의 1비트 threshold를 128→200으로 올림 → 일반 텍스트는
     진해졌지만 footer(검은 배경+흰 글씨)의 흰 글씨 가장자리까지 검게 먹혀서 사라짐. **전역
     threshold 하나로는 "밝은배경+어두운글씨"와 "어두운배경+밝은글씨"를 동시에 못 맞춤** — threshold는
     128로 원복.
   - 2차: `resultImage.ts`의 회색 보조 텍스트(`#555555`/`#666666` — 날짜값/테이블헤더/아티스트명/
     키워드/총재생시간)를 전부 순검정(`#000000`)으로 바꾸고 bold 폰트로 변경. **프린터는 1비트라
     회색을 못 찍는데, 회색+작은글씨+안티앨리어싱 조합이 특히 잘 날아감.** footer는 원래도 잘
     나왔으므로 손대지 않음. → 본문(곡 목록 등)은 진해짐.
   - 3차: 그래도 안 진해서 `fillTextBold()` 헬퍼 추가 — 같은 텍스트를 0.6px 오프셋 4곳에 겹쳐
     그려서 안티앨리어싱 가장자리의 커버리지를 누적시킴 (footer 제외).
   - 4차: 그래도 **로고/DATE/테이블 헤더 등 이미지 맨 위쪽만** 유독 연함 — 다른 곳과 똑같은
     처리를 했는데도 안 됨. 테스트 인쇄("안녕")는 세로 중앙정렬이라 실제 잉크 전에 빈 줄이
     ~56줄 있었고 항상 진하게 나왔던 것과 대조해보고, **프린터 헤드가 인쇄 시작 직후엔 아직
     완전히 밀착/예열이 안 돼서 맨 앞부분이 약하게 찍히는 하드웨어 특성**으로 추정.
     `printerProtocol.ts`에 `WARMUP_ROWS = 56`짜리 빈 라스터를 실제 이미지 앞에 붙이는 것으로
     대응 (관련 커밋: 위 순서대로 threshold 원복 → 회색→검정 → fillTextBold → WARMUP_ROWS).
   - **다음 세션에서 확인할 것**: 4차(warm-up) 적용 후 실물로 로고/DATE/테이블 헤더까지 진하게
     나왔는지 아직 최종 확인 못 함 — admin-client가 메모리 부족으로 재시작되는 와중에 대화가
     이어짐. 여전히 연하면 `WARMUP_ROWS` 값을 더 키우거나(예: 80~100), `bluetoothPrinter.ts`의
     `sendToPrinter()`가 `port.open()` 직후 바로 쓰기 시작하는 부분에 짧은 delay(예: 200~300ms)를
     추가하는 것도 시도해볼 만함.

3. **이 컴퓨터에서 admin-client가 낮은 메모리 때문에 반복적으로 "killed" 알림을 받음**
   ([[windows-low-memory-kills-dev-servers]] 참고, 이번에 새 대응법 기록함). 한 번은 harness가
   추적하던 wrapper만 죽고 실제 프로세스는 살아있었지만(정상 동작 지속), 한 번은 `tsx watch`
   감시자는 살아있는데 실제 작업 child(`src/index.ts`)가 조용히 사라져서 **admin-client가 실제로는
   안 돌고 있는데 프로세스 목록만 보면 멀쩡해 보이는** 상태였음 ([[windows-taskstop-orphans-child-processes]]에
   새 사례로 기록). 최종적으로 PowerShell `Start-Process`로 harness 추적과 분리된 완전 독립
   프로세스로 띄워서 해결 — 로그는 `C:\Users\82105\admin-client.log`에 쌓임. **다음 세션에서 이
   컴퓨터로 admin-client를 다시 띄울 일이 있으면, run_in_background 대신 처음부터 이 방식을 쓸 것.**

## 이전 상태 (2026-09-25, 오전) — Railway 배포 + 배포/프린터 연결 절차 문서화

2026-09-24 세션 마지막에 Railway 배포까지 끝냈던 것을, 다른 사람(다른 계정)이 그대로
따라할 수 있게 문서로 정리함. 코드 변경은 admin-client의 macOS 지원 보강 정도이고,
나머지는 전부 문서/메모 작업.

- **`RAILWAY_DEPLOY.md`** (신규): 백엔드/프론트엔드를 처음부터 Railway에 새로 배포하는 전체 절차.
  실제로 겪었던 문제(admin-client가 같이 배포되려던 것, `--env-file` 크래시)와
  트라이얼 요금제(23일/$5) 주의사항 포함. "다른 계정으로 통째로 새로 배포하고 싶다"는
  요청에 대응.
- **`PRINTER_SETUP.md`** (신규): 백엔드/프론트엔드는 이미 떠 있는 상태에서 **admin-client만
  새 컴퓨터에서 새로 연결**하는 절차 (재배포 불필요). "다른 지역에서 프린터만 새로 놓고
  싶다"는 요청에 대응 — 사용자가 실제로 겪은 시나리오(다른 지역 친구가 출력 눌렀는데
  admin-client가 그 컴퓨터에 없어서 안 됨)에서 나온 문서.
- **admin-client macOS 지원**: `serialport`가 원래 크로스플랫폼이라 로직 수정은 불필요했고,
  `npm run list-ports`(신규, `src/listPorts.ts`) 추가 + 주석/문서에 macOS(`/dev/cu.*`) 경로
  안내 추가. **macOS Classic Bluetooth SPP 실기기 검증은 아직 안 됨** — Windows만 검증됨.
- ⚠️ **`ADMIN_TOKEN` 실제 값은 어떤 문서에도 적지 않음** (공개 레포라 프로덕션 토큰 노출 위험) —
  문서에는 "직접 랜덤 생성" 안내만 있음. 새 배포 시 새 토큰 필요.
- **admin-client는 한 번에 한 곳에서만 실행해야 함**(같은 큐를 두고 경쟁 방지) — `PRINTER_SETUP.md`에
  명시함. 새 컴퓨터에서 켜기 전 기존 admin-client는 꺼야 함.

## 이전 상태 (2026-09-24) — 실제 아티스트 웹앱(SH_PT/wavelog)과 백엔드 연동 완료

**사용자 웹앱 UI가 진행 중이던 별도 저장소를 찾았고(`https://github.com/Jun11561/SH_PT`,
로컬 `~/SH_PT/frontend`, 이름 "wavelog"), 이 저장소의 API에 실제로 연결해서 E2E 검증까지 끝냄.**
지난 세션까지는 "아티스트 웹앱은 별개 저장소에서 직접 진행 중"이라고만 적어뒀었는데, 이제 그 저장소를
찾아서 실제로 붙였다.

1. **데이터 모델을 프론트(실제 피그마 반영본) 기준으로 확장함 — 기존 "유사 아티스트" 개념 폐기**
   - 기존엔 `Artist { id, name, imageUrl, audioPreviewUrl }` + `ArtistDetail.similarArtists`(이름+한줄이유)
     였는데, 프론트는 스테이지/태그/대표곡/유사**곡**(재생시간 포함)/영수증용 키워드가 다 필요해서
     구조 자체가 안 맞았음.
   - `packages/shared/src/types.ts`: `Song`(title/artist/playtime/coverUrl/coverHasText) 신설,
     `Artist`에 `shortName`/`stage`/`tags`/`mainSong`/`similarSongs`(곡 4개)/`keywords` 추가.
     `ArtistDetail`/`SimilarArtist`는 제거 (이제 `Artist` 하나로 카드+결과 화면 다 커버).
   - `data/artists.json` 9팀 전부 새 스키마로 변환함. **단, 곡 제목/재생시간은 여전히 placeholder**
     ("샘플곡 1" 등) — 실제 9팀 콘텐츠 채우기는 README "아직 손대야 할 부분" 1번 그대로 남아있는 TODO.
   - `GET /api/artists`가 이제 카드 화면에 필요한 필드만 골라내지 않고 전체 `Artist[]`를 반환함
     (프론트가 목록을 한 번만 불러와 캐시하는 방식이라, 카드/결과 화면 둘 다 이걸로 커버).
   - `resultImage.ts`의 플레이스홀더 생성기도 유사아티스트 목록 대신 대표곡+유사곡 목록을 찍도록 수정.

2. **프론트 `api/client.ts`를 실제 백엔드 스펙에 맞게 재작성함**
   - `useMock: false`로 전환, `.env`에 `VITE_API_BASE_URL=http://localhost:3000`.
   - 세션 발급(`POST /api/session`)을 앱 시작 시 한 번 호출해서 캐시하고, 출력 요청 때 씀
     (기존 프론트엔 세션 개념 자체가 없었음 — 새로 추가).
   - 출력 요청 엔드포인트가 프론트가 원래 가정했던 `POST /api/print`가 아니라 실제로는
     `POST /api/print-jobs`이고, `{sessionId, artistId}`만 받음 (곡 목록은 서버가 이미
     결과지 이미지를 갖고 있어서 필요 없음 — 영수증 화면 표시에만 씀).
   - **출력 완료 판정 방식이 다름**: `/api/print-jobs`는 즉시 `{jobId, queuePosition}`만 반환하고
     실제 인쇄는 admin-client가 비동기로 폴링해서 처리함. 그래서 프론트가
     `GET /api/print-jobs/:id`를 1초 간격(최대 60초)으로 폴링해서 `status`가
     `completed`/`failed`가 될 때까지 기다리도록 `pollPrintJob()` 추가.
   - `saveResult()`는 백엔드에 대응 엔드포인트(`/api/results`)가 아직 없고 어느 컴포넌트도
     호출하지 않는 죽은 코드라서, 실제 호출은 하지 않고 no-op으로만 둠.

3. **E2E로 검증함 (로컬)**: 서버(`npm run dev:server`) + 프론트(`~/SH_PT/frontend`, `npm run dev`)
   + admin-client(`npm run dev:admin`, 이번 검증에서만 `.env`는 안 건드리고 `DRY_RUN=true`
   환경변수로 덮어써서 실행 — 실제 `.env`는 `DRY_RUN=false`/`PRINTER_COM_PORT=COM6`로 그대로 둠)를
   전부 띄우고, 브라우저에서 Intro→Select→Result→영수증→출력까지 실제로 클릭해서 끝까지 갔음.
   admin-client 로그에 job이 dequeue→complete 되는 것, 프론트가 폴링으로 완료를 감지하고
   `/done`으로 넘어가는 것까지 확인함.

4. **이어서 같은 세션에: 아티스트 실제 콘텐츠 + 이미지 서빙까지 채움.**
   프론트 mock(`data/artists.ts`, `src/assets/artists/<id>/*.jpg`)에 이미 9팀 진짜 사진·곡 정보가
   있었던 걸 발견 — 백엔드로 옮김.
   - `packages/server/assets/media/artists/<id>/{photo,album,sim1~4}.jpg`로 9팀 이미지 전부 복사.
   - `index.ts`에 `app.use("/media", express.static(...))` 추가.
   - `data/artists.json`을 placeholder 대신 실제 곡 제목/아티스트/재생시간/태그로 재작성,
     id도 `artist-01` 같은 임의값 대신 실제 슬러그(`yoonmarch`, `touched`, `owol`, `atlus`,
     `leedoor`, `oneokrock`, `juhyerin`, `87dance`, `yb`)로 통일.
   - 오디오 mp3는 여전히 없음 — 이건 프론트 mock 때도 원래 없었던 상태
     (`public/audio/README.md`: "파일 없어도 앱은 동작, 재생만 스킵"). 오늘 만든 문제 아님, 그대로 TODO.

5. **결과지(인쇄물) 디자인을 화면상 "영수증" 모달과 똑같이 그리도록 재작성.**
   기존 `resultImage.ts`의 자동생성 placeholder는 그냥 밋밋한 텍스트 목록이라 사용자가 화면에서
   보는 영수증(`Receipt.tsx`: 로고/DATE/N·SONG·ARTIST·PLAYTIME 표/키워드·총재생시간/안내문구)과
   전혀 다르게 나왔음 — 실기기로 뽑아보고서야 발견됨. `Receipt.css`의 그리드 비율(17/36/28/19)과
   레이아웃을 `@napi-rs/canvas`로 그대로 재현하도록 다시 씀 (긴 제목/아티스트명 자동 줄바꿈 포함).
   - 처음엔 로고 자리에 "wavelog"라는 **글자**를 그렸었는데, 실제 화면엔 아이콘 마크만 있고
     텍스트가 없다는 걸 실물 인쇄 확인 중 지적받아서 고침 — `Logo.tsx`의 `LogoMark` SVG 경로
     (사선 바 2개 + 점)를 좌표 그대로 캔버스 path로 옮겨 그림.
   - 아직 손으로 디자인한 PNG(`assets/results/<id>.png`)는 없고 이 자동생성 버전으로 대체 중인
     상태 — README 3번 TODO는 여전히 유효하지만, 이제 최소한 화면과 인쇄물이 같은 모양임.

6. **T02 실기기로 인쇄 검증 완료.** admin-client를 실제 `.env`(`DRY_RUN=false`,
   `PRINTER_COM_PORT=COM6`) 그대로 띄워서: (1) 관리자 "테스트 인쇄" 버튼 경로("안녕")가 실제
   종이로 정상 출력됨, (2) 실제 아티스트(윤마치) 선택 → 위 5번의 새 영수증 디자인이 실기기에
   정상 출력됨, 둘 다 사용자가 실물로 확인함. 실기기로 뽑아보고서야 로고가 아이콘이 아니라
   "wavelog" 텍스트로 잘못 그려진 걸 발견해서 5번에 적힌 대로 고침.
   **README "아직 손대야 할 부분" 5번(프린터 프로토콜 미검증)은 이걸로 사실상 해결.**

7. **DATE가 하드코딩돼 있던 버그 수정.** 화면(`Receipt.tsx`)과 인쇄물(`resultImage.ts`) 둘 다
   `appConfig.receiptDate = '2026-10-26-31'` 고정값을 쓰고 있어서 실물 인쇄에서 이상하게 보였음
   ("행사 기간"으로 의도한 값이었는데 실제로는 그냥 이상한 날짜로 보임). 렌더링 시점의 오늘
   날짜(`YYYY-MM-DD`)를 계산하는 `todayDate()`로 양쪽 다 교체 — 프론트 `appConfig.receiptDate`
   필드 자체를 제거함. (프론트 dev 서버가 코드 수정 중간에 죽어있었던 적이 있어서, 인쇄물은
   최신인데 브라우저 화면은 예전 번들 그대로 보였던 적도 있었음 — dev 서버 재시작 + 새로고침으로
   해결. 실제 버그는 아니고 이 세션 환경 특성, [[windows-low-memory-kills-dev-servers]] 참고.)

9. **오디오 미리듣기: mp3 파일 대신 YouTube 임베드로 해결.**
   자체 mp3 파일을 구하려면 실제 음원 라이선스가 있어야 해서(비상업적이어도 공개 장소 재생은
   원칙적으로 KOMCA 등 이용허락 필요 — "비상업이니 괜찮다"는 전제가 틀렸음), 대신 각 아티스트
   대표곡의 **YouTube 공식 업로드를 화면에 안 보이게 임베드해서 재생**하는 쪽으로 결정함.
   - Spotify Web API(`preview_url`)도 시도해봤으나 **"앱 소유자 계정이 프리미엄 구독이어야
     함"**이라는 403 에러로 막힘 — API 자체는 무료지만 이 자격 조건 때문에 포기.
     `packages/server/.env`에 `SPOTIFY_CLIENT_ID`/`SPOTIFY_CLIENT_SECRET`가 남아있는데 **지금은
     안 씀** (나중에 프리미엄 계정으로 재시도하고 싶으면 참고용으로만 남겨둠).
   - `packages/shared/src/types.ts`: `Artist.audioPreviewUrl` → `Artist.youtubeVideoId`로 교체.
   - `data/artists.json`: 9팀 전부 실제 YouTube 영상 id로 채움 (사용자가 하나하나 직접 확인해준
     링크 기준 — 특히 `atlus`/`touched`는 검색만으로는 못 찾거나 다른 저작물과 헷갈릴 뻔해서
     반드시 링크로 재확인 받음).
   - `useAudioPlayer.tsx`를 native `<audio>`에서 **YouTube IFrame Player API**로 전면 재작성.
     ⚠️ **트리키했던 버그**: YT.Player는 자기 타겟 엘리먼트를 몰래 `<iframe>`으로 바꿔치기하는데,
     이 타겟이 React가 렌더링/추적하는 노드면 React reconciler와 충돌해서
     "insertBefore/removeChild: not a child" 에러로 화면 전체가 깨짐(StrictMode 이중 렌더에서
     특히 잘 남). 해결: 마운트 대상을 `document.body`에 직접 붙인, **React가 전혀 모르는 순수
     DOM 노드**로 분리 (JSX로 렌더링하지 않음). 이런 서드파티 DOM 위젯을 React에 붙일 때 일반적으로
     쓰는 패턴.
   - 실기기 화면(0x0 크기, 완전히 안 보임)과 실제 소리 재생 둘 다 사용자가 확인함.

10. **남은 것**
    - 손으로 디자인한 결과지 PNG로 교체 (지금은 5번의 자동생성 버전, README 2번 그대로 TODO).
    - `~/SH_PT`는 이 저장소와 별개 git 저장소이므로, 여기 변경사항(shared 타입)과 그쪽 변경사항
      (`useAudioPlayer.tsx`, `api/client.ts`)은 각자 따로 커밋해야 함.

## 이전 세션: E2E 플로우 전체 검증 완료 (2026-09-22, 노트북에서)

**블루투스 인쇄 + NFC 태그 접속까지 전부 성공.** 남은 건 실제 아티스트용 웹앱 UI 완성뿐,
인쇄 파이프라인/블루투스/네트워크 쪽은 더 이상 의심할 필요 없음.

1. **프린터 인쇄 (USB + 블루투스 둘 다 검증됨)**
   T02("mini chew" 브랜드, MAC=`8E:0C:90:23:DF:1A`, S/N=Q491K4C54550646)에
   **블루투스**로 연결해서 관리자 페이지 "테스트 인쇄" 버튼으로 실제 "안녕" 인쇄 성공 확인함
   (`PRINTER_COM_PORT=COM6`, `DRY_RUN=false`). USB 유선(COM9)로도 이미 인쇄 검증됐던 상태라,
   이제 프린터 프로토콜/펌웨어와 블루투스 연결 둘 다 정상 동작 확인됨 — 행사 당일 무선 운영 가능.
   ⚠️ COM 포트 번호는 재페어링/재부팅마다 바뀔 수 있으니 새 세션에서는 `Get-PnpDevice`로
   다시 확인할 것 (아래 "여기까지 오게 된 경위" 참고).

2. **NFC 태그 → 웹 접속 (풀 플로우 검증 완료)**
   노트북을 서버로 켜둔 채, 폰을 같은 Wi-Fi에 연결해서 (1) `http://<노트북LAN IP>:3000/test.html`을
   폰 브라우저로 직접 열어 접속 확인, (2) "NFC Tools" 앱으로 실제 빈 NFC 태그에 그 URL을 기록,
   (3) 폰으로 태그를 태깅해서 `test.html`이 자동으로 뜨는 것까지 — **셋 다 성공 확인됨.**
   이번 세션 노트북 LAN IP는 `172.30.32.105`였음 (DHCP라 다음 세션엔 `ipconfig`/
   `Get-NetIPAddress`로 재확인 필요, 태그에 새 IP로 다시 기록해야 함). Windows 방화벽에
   Node.js 인바운드 허용 규칙이 이미 있어서(Public 프로필 포함) 별도 방화벽 설정 없이 바로 됐음.

**여기까지 오게 된 경위 (다음에 비슷한 문제 생기면 참고):**
- 증상: Windows 설정에서 페어링하면 "minichew — 드라이버를 사용할 수 없음"이 떴고, 페어링
  직후 COM 포트가 전혀 안 만들어졌음. 원인으로 추정했던 것: 이 프린터가 블루투스 Class of
  Device를 **"Imaging → Printer"**(0x100680)로 광고해서 Windows가 자동으로 프린터 드라이버
  설치를 시도하다 실패 → SPP(시리얼 포트 프로파일) 서비스가 캐시에 안 잡힘.
- `WSALookupServiceBeginW` + `LUP_FLUSHCACHE`로 SDP 강제 재조회를 시도했는데, **관리자 권한으로
  실행해도 여전히 `err=10022`(WSAEINVAL)로 실패함** — 이걸로 "권한 문제였다"는 가설은 기각됨.
  이 스크립트 경로는 더 이상 팔 필요 없음.
- **실제로 문제를 해결한 것은 노트북 재부팅이었음.** 재부팅 후 `Get-PnpDevice`로 확인하니
  `표준 Bluetooth에서 직렬 링크(COM6)`가 프린터 MAC(`8E0C9023DF1A`)에 매핑되어 `Status: OK`로
  잡혀 있었음. SDP 강제 재조회 없이, 그냥 재부팅만으로 Windows의 SPP 캐시가 정상화된 것으로 보임.
- 교훈: 이런 블루투스 "드라이버를 사용할 수 없음" + COM 포트 미생성 증상이 다시 생기면,
  관리자 권한 스크립트보다 **재부팅 → `Get-PnpDevice`로 COM 포트 재확인**을 먼저 시도할 것.

## 지금 뭘 하고 있었나 (2026-09-24 기준)

목표였던 **"NFC 태그 → 웹 → Phomemo T02 블루투스 프린터로 실물 인쇄"** 엔드투엔드 검증은
2026-09-22에 완료됐고, **"사용자 웹앱 UI를 실제 백엔드에 연동" + "그 연동 결과를 실기기로
인쇄까지 검증" + "아티스트 배경음악을 YouTube 임베드로 연결"**도 같은 날(2026-09-24)에 전부
끝났다 (위 "⭐ 최신 상태" 1~9번 참고, `~/SH_PT/frontend`). 아티스트 데이터·이미지·오디오까지
전부 실제 9팀 콘텐츠로 채워졌고, 인쇄물도 화면상 영수증과 같은 디자인으로 실기기 출력까지
확인됨. `test.html`/관리자 페이지 "테스트 인쇄" 버튼은 이제 순수히 디버깅용 보조 경로이고,
실제 사용자 플로우는 SH_PT 쪽 UI가 이 저장소의 API를 직접 호출한다.

다음에 이어갈 부분은 위 "⭐ 최신 상태" 10번에 적힌 남은 TODO(손으로 디자인한 결과지 PNG로
교체) — 이건 디자인 리소스가 있어야 하는 작업이라 코드만으로는 못 끝냄.

**데스크탑(이 저장소를 원래 세팅했던 PC, 메인보드 H510)에는 블루투스 어댑터가 아예 없다** —
확인해보니 시스템에 Bluetooth 장치 자체가 안 잡힘 (USB 동글도 없음). 그래서 **노트북으로 옮겨서
테스트했음.** 프린터/NFC 테스트는 계속 노트북에서 진행할 것.

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
