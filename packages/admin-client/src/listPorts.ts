import { SerialPort } from "serialport";

// Bluetooth 페어링 후 OS가 만들어준 시리얼 장치 경로를 찾기 위한 도우미.
// Windows는 COM 포트 이름이 짧고 예측 가능하지만(COM5 등), macOS는
// /dev/cu.<기기이름>-<프로필> 형태라 페어링해보기 전엔 정확한 값을 알 수 없다.
async function main(): Promise<void> {
  const ports = await SerialPort.list();
  if (ports.length === 0) {
    console.log("연결된 시리얼 포트가 없습니다. 먼저 OS 블루투스 설정에서 프린터를 페어링하세요.");
    return;
  }
  console.log("사용 가능한 시리얼 포트:");
  for (const p of ports) {
    const label = [p.manufacturer, p.pnpId].filter(Boolean).join(" / ");
    console.log(`  ${p.path}${label ? ` (${label})` : ""}`);
  }
  console.log("\n이 중 프린터에 해당하는 경로를 .env의 PRINTER_COM_PORT에 넣으세요.");
}

main();
