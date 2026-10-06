#!/usr/bin/env bash
# admin-client를 새 컴퓨터(이 저장소를 처음 클론한 Mac/Windows)에서 바로 띄우기 위한 설치 스크립트.
# 자세한 절차/문제 상황별 설명은 레포 루트의 PRINTER_SETUP.md 참고 -- 이 스크립트는 그 문서의
# 2~3번(설치 + .env 준비)까지만 자동화하고, 나머지(블루투스 페어링/COM 포트 채우기/실행)는
# 사람이 직접 해야 하는 부분이라 출력으로 안내만 함.
#
# 사용법: 저장소 루트에서  bash scripts/setup-admin-client.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "== 1/4 Node.js 확인/설치 =="
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js가 없습니다."
  if [ "$(uname -s)" = "Darwin" ]; then
    echo "macOS로 보여서 Homebrew로 자동 설치를 시도합니다."
    if ! command -v brew >/dev/null 2>&1; then
      echo "Homebrew도 없어서 먼저 설치합니다 -- 중간에 관리자 비밀번호를 물어볼 수 있습니다."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      # 방금 설치한 brew를 이 셸 세션 PATH에 즉시 반영 (Apple Silicon/Intel 경로 둘 다 대응)
      if [ -x /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      elif [ -x /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
      fi
    fi
    echo "brew install node 실행 중..."
    brew install node
  else
    echo "자동 설치는 macOS만 지원합니다. https://nodejs.org 에서 18 이상 설치 후 다시 실행하세요."
    exit 1
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 자동 설치에 실패했습니다. https://nodejs.org 에서 직접 설치 후 다시 실행하세요."
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "Node.js 18 이상이 필요합니다 (현재: $(node -v))."
  exit 1
fi
echo "OK: $(node -v)"

echo "== 2/4 의존성 설치 (npm install) =="
if ! npm install; then
  echo ""
  echo "npm install 실패 -- macOS에서는 serialport 같은 네이티브 모듈 빌드에 Xcode Command Line"
  echo "Tools가 필요할 수 있습니다. 아래 실행 후 설치 창 뜨면 완료하고 이 스크립트를 다시 실행하세요:"
  echo "  xcode-select --install"
  exit 1
fi

echo "== 3/4 shared 패키지 빌드 =="
npm run build --workspace packages/shared

echo "== 4/4 admin-client .env 준비 =="
cd packages/admin-client
if [ -f .env ]; then
  echo ".env 이미 있음 -- 건드리지 않음"
else
  cp .env.example .env
  echo ".env.example을 복사해서 .env 생성함. ADMIN_TOKEN 값을 채워야 합니다."
fi

cat <<'EOF'

여기까지는 끝났습니다. 남은 건 사람이 직접 해야 하는 부분입니다 (PRINTER_SETUP.md 4~9번):

  1. 프린터를 이 컴퓨터의 OS 블루투스 설정에서 페어링
     (macOS: 시스템 설정 → Bluetooth)
  2. 이 디렉터리(packages/admin-client)에서  npm run list-ports  실행 →
     출력된 목록에서 프린터에 해당하는 장치 경로 확인 (macOS는 /dev/cu.* 형태)
  3. packages/admin-client/.env 를 열어서:
       - ADMIN_TOKEN: Railway 백엔드 Variables에 설정된 값과 반드시 동일하게 채움
                      (저장소엔 없음 -- 기존 운영자에게 직접 전달받을 것)
       - PRINTER_COM_PORT: 2번에서 확인한 장치 경로로 채움
  4. npm run dev  로 admin-client 실행 → 콘솔에
       "admin-client polling https://... every 2000ms"
       "printer expected at <경로>"
     로그가 뜨는지 확인
  5. 먼저 DRY_RUN=true로 신호 경로 확인 후, 실제 출력 확인되면 DRY_RUN=false로 바꾸고 재시작

EOF
