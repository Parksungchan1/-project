import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ArtistDetail } from "@festival-nfc/shared";

// Cloud Linux hosts usually ship no Hangul-capable font, so Korean text
// renders as blank boxes unless we register one explicitly. Drop a font
// file (e.g. Noto Sans KR) at packages/server/assets/fonts/korean.ttf.
const koreanFontPath = join(__dirname, "..", "..", "assets", "fonts", "korean.ttf");
if (existsSync(koreanFontPath)) {
  GlobalFonts.registerFromPath(koreanFontPath, "sans-serif");
}

// T02 prints at 203dpi over a 48mm head -> 48mm / 25.4 * 203 ≈ 384px wide.
// This is the hard constraint the admin-client's raster conversion assumes;
// don't change WIDTH without updating packages/admin-client/src/printerProtocol.ts.
const WIDTH = 384;
const PADDING = 20;
const LINE_HEIGHT = 34;
const ITEM_HEIGHT = 60;

export function renderResultImage(artist: ArtistDetail): Buffer {
  const height =
    PADDING * 2 + // top/bottom padding
    60 + // title
    40 + // "추천 아티스트" heading
    artist.similarArtists.length * ITEM_HEIGHT +
    50; // footer

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext("2d");

  // Background: white (thermal printers only render what's non-white as black)
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";

  let y = PADDING + 30;

  ctx.font = "bold 28px sans-serif";
  ctx.fillText(artist.name, WIDTH / 2, y);
  y += LINE_HEIGHT;

  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.lineWidth = 2;
  ctx.stroke();
  y += 36;

  ctx.font = "bold 20px sans-serif";
  ctx.fillText("추천 아티스트", WIDTH / 2, y);
  y += 36;

  ctx.font = "20px sans-serif";
  for (const similar of artist.similarArtists) {
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(similar.name, WIDTH / 2, y);
    y += 26;
    if (similar.reason) {
      ctx.font = "16px sans-serif";
      ctx.fillText(similar.reason, WIDTH / 2, y);
    }
    y += ITEM_HEIGHT - 26;
  }

  return canvas.toBuffer("image/png");
}

export function renderResultImageBase64(artist: ArtistDetail): string {
  return renderResultImage(artist).toString("base64");
}
