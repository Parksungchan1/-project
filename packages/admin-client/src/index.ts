import type { DequeuePrintJobResponse } from "@festival-nfc/shared";
import { config } from "./config";
import { pngToPrinterCommand } from "./printerProtocol";
import { sendToPrinter } from "./bluetoothPrinter";

async function callAdminApi(path: string, method: "GET" | "POST"): Promise<Response> {
  return fetch(`${config.serverUrl}${path}`, {
    method,
    headers: { "x-admin-token": config.adminToken },
  });
}

async function pollOnce(): Promise<void> {
  const res = await callAdminApi("/api/print-jobs/dequeue", "POST");
  if (!res.ok) {
    console.error("dequeue failed", res.status, await res.text());
    return;
  }
  const { job } = (await res.json()) as DequeuePrintJobResponse;
  if (!job) return; // queue empty

  console.log(`printing job ${job.id} (artist ${job.artistId})`);
  try {
    if (config.dryRun) {
      console.log(`[DRY_RUN] would send ${job.imageBase64.length}-char image to ${config.printerComPort}`);
    } else {
      const pngBuffer = Buffer.from(job.imageBase64, "base64");
      const command = await pngToPrinterCommand(pngBuffer);
      await sendToPrinter(command);
    }
    await callAdminApi(`/api/print-jobs/${job.id}/complete`, "POST");
    console.log(`job ${job.id} done`);
  } catch (err) {
    console.error(`job ${job.id} failed`, err);
    await callAdminApi(`/api/print-jobs/${job.id}/fail`, "POST");
  }
}

async function main(): Promise<void> {
  console.log(`admin-client polling ${config.serverUrl} every ${config.pollIntervalMs}ms`);
  console.log(`printer expected at ${config.printerComPort}`);
  for (;;) {
    try {
      await pollOnce();
    } catch (err) {
      console.error("poll loop error", err);
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
}

main();
