import { SerialPort } from "serialport";
import { config } from "./config";

// Pairing happens once, manually, via Windows Bluetooth settings -- this
// just writes bytes to the COM port Windows exposes for that paired device.
// Chunked with a short delay between writes because some Phomemo firmwares
// drop bytes if you slam the whole raster through in one write().
const CHUNK_SIZE = 4096;
const CHUNK_DELAY_MS = 20;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendToPrinter(command: Buffer): Promise<void> {
  const port = new SerialPort({ path: config.printerComPort, baudRate: 9600, autoOpen: false });

  await new Promise<void>((resolve, reject) => {
    port.open((err) => (err ? reject(err) : resolve()));
  });

  try {
    for (let offset = 0; offset < command.length; offset += CHUNK_SIZE) {
      const chunk = command.subarray(offset, offset + CHUNK_SIZE);
      await new Promise<void>((resolve, reject) => {
        port.write(chunk, (err) => (err ? reject(err) : resolve()));
      });
      await delay(CHUNK_DELAY_MS);
    }
  } finally {
    await new Promise<void>((resolve) => port.close(() => resolve()));
  }
}
