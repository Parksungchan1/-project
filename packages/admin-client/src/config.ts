export const config = {
  serverUrl: process.env.SERVER_URL ?? "http://localhost:3000",
  adminToken: process.env.ADMIN_TOKEN ?? "",
  // Windows assigns an outgoing COM port to a paired Bluetooth SPP device
  // (Settings > Devices > Bluetooth > More Bluetooth options > COM Ports tab).
  // Find the port name there and set it here once the T02 is paired.
  printerComPort: process.env.PRINTER_COM_PORT ?? "COM5",
  pollIntervalMs: process.env.POLL_INTERVAL_MS ? Number(process.env.POLL_INTERVAL_MS) : 1000,
  // No printer/COM port yet? Set DRY_RUN=true to confirm the server<->admin
  // signal path (job picked up, marked complete) without touching Bluetooth.
  dryRun: process.env.DRY_RUN === "true",
};
