export const config = {
  serverUrl: process.env.SERVER_URL ?? "http://localhost:3000",
  adminToken: process.env.ADMIN_TOKEN ?? "",
  // OS assigns a serial device path to a paired Bluetooth SPP device once
  // it's paired: Windows exposes it as a COM port (Settings > Devices >
  // Bluetooth > More Bluetooth options > COM Ports tab, e.g. "COM5"), macOS
  // as /dev/cu.<device>-<profile> (e.g. "/dev/cu.T02-SPPDev-1"). Run
  // `npm run list-ports` after pairing to see what's actually available.
  printerComPort: process.env.PRINTER_COM_PORT ?? "COM5",
  pollIntervalMs: process.env.POLL_INTERVAL_MS ? Number(process.env.POLL_INTERVAL_MS) : 1000,
  // No printer/COM port yet? Set DRY_RUN=true to confirm the server<->admin
  // signal path (job picked up, marked complete) without touching Bluetooth.
  dryRun: process.env.DRY_RUN === "true",
};
