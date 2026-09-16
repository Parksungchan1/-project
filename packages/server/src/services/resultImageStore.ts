import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listArtists } from "./artistStore";
import { renderResultImageBase64 } from "./resultImage";

// 9 artists -> 9 possible result strips. They don't change per request, so
// we resolve each one once at startup and hand out the same base64 string
// every time a print job is created for that artist.
//
// Drop a hand-designed file at packages/server/assets/results/<artistId>.png
// (384px wide, matches the T02's 48mm head) and it's used automatically.
// Until then, resultImage.ts auto-generates a placeholder so the pipeline
// still works end-to-end.
const RESULTS_DIR = join(__dirname, "..", "..", "assets", "results");

const cache = new Map<string, string>();

function loadOrGenerate(artistId: string): string {
  const staticPath = join(RESULTS_DIR, `${artistId}.png`);
  if (existsSync(staticPath)) {
    return readFileSync(staticPath).toString("base64");
  }
  const artist = listArtists().find((a) => a.id === artistId);
  if (!artist) {
    throw new Error(`unknown artistId: ${artistId}`);
  }
  console.warn(`[resultImageStore] no static design for ${artistId}, using generated placeholder`);
  return renderResultImageBase64(artist);
}

export function initResultImageCache(): void {
  for (const artist of listArtists()) {
    cache.set(artist.id, loadOrGenerate(artist.id));
  }
}

export function getResultImageBase64(artistId: string): string {
  const cached = cache.get(artistId);
  if (cached) return cached;
  // Lazy fallback in case initResultImageCache() wasn't called or a new
  // artist was added without a restart.
  const generated = loadOrGenerate(artistId);
  cache.set(artistId, generated);
  return generated;
}
