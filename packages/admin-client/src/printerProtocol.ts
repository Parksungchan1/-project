import { loadImage, createCanvas } from "@napi-rs/canvas";

// T02 is a Phomemo-family thermal printer. Command bytes below follow the
// reverse-engineered protocol documented by github.com/vivier/phomemo-tools.
// VERIFY against the real T02 once it's in hand -- header bytes are known to
// vary slightly between Phomemo sub-models (T02 vs T02C vs T02S etc).
const ESC = 0x1b;
const GS = 0x1d;

const INIT = Buffer.from([ESC, 0x40]);
function feedLines(n: number): Buffer {
  return Buffer.from([ESC, 0x64, n]);
}

/**
 * Converts a PNG buffer (expected 384px wide -- the server renders result
 * strips at exactly that width, see packages/server/src/services/resultImage.ts)
 * into a 1-bit-per-pixel raster and wraps it in the GS v 0 print command.
 */
export async function pngToPrinterCommand(pngBuffer: Buffer): Promise<Buffer> {
  const image = await loadImage(pngBuffer);
  const width = image.width;
  const height = image.height;
  const bytesPerRow = Math.ceil(width / 8);

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  const raster = Buffer.alloc(bytesPerRow * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      // Raising this to fix faint dark-on-light text (small anti-aliased
      // strokes losing their edge pixels) also wrecks the footer band's white
      // text on a dark fill -- its anti-aliased edges start counting as ink
      // too and the white letters get swallowed into solid black. One global
      // cutoff can't serve both cases, so darkness for normal text is handled
      // by bolding the source fonts in resultImage.ts instead; leave this at
      // the original faithful threshold.
      const isBlack = luminance < 128;
      if (isBlack) {
        const byteIndex = y * bytesPerRow + (x >> 3);
        const bitMask = 0x80 >> (x % 8);
        raster[byteIndex] |= bitMask;
      }
    }
  }

  const xL = bytesPerRow & 0xff;
  const xH = (bytesPerRow >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;
  const rasterHeader = Buffer.from([GS, 0x76, 0x30, 0x00, xL, xH, yL, yH]);

  return Buffer.concat([INIT, rasterHeader, raster, feedLines(3)]);
}
