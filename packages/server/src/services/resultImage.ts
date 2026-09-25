import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Artist } from "@festival-nfc/shared";

// Cloud Linux hosts usually ship no Hangul-capable font, so Korean text
// renders as blank boxes unless we register one explicitly. Noto Sans KR
// (SIL OFL, see assets/fonts/NotoSansKR-OFL.txt) is bundled and committed
// so this works the same in dev and in production without any manual setup.
const koreanFontPath = join(__dirname, "..", "..", "assets", "fonts", "NotoSansKR-Regular.ttf");
if (existsSync(koreanFontPath)) {
  GlobalFonts.registerFromPath(koreanFontPath, "sans-serif");
}

// T02 prints at 203dpi over a 48mm head -> 48mm / 25.4 * 203 ≈ 384px wide.
// This is the hard constraint the admin-client's raster conversion assumes;
// don't change WIDTH without updating packages/admin-client/src/printerProtocol.ts.
const WIDTH = 384;
const PADDING = 20;
const CONTENT_WIDTH = WIDTH - PADDING * 2;

/** "YYYY-MM-DD" for today, mirrors the on-screen receipt's Receipt.tsx todayDate(). */
function todayDate(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Column layout mirrors the on-screen receipt's CSS grid
// (frontend/src/components/Receipt.css: grid-template-columns 17fr 36fr 28fr 19fr).
const COLS = (() => {
  const fr = [17, 36, 28, 19];
  const total = fr.reduce((a, b) => a + b, 0);
  let x = PADDING;
  return fr.map((f) => {
    const w = (CONTENT_WIDTH * f) / total;
    const col = { x, width: w };
    x += w;
    return col;
  });
})();

/** Greedy word-wrap that also breaks a single too-wide word/syllable-run by character (Korean has no spaces within a title). */
function wrapText(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  const words = text.split(" ");
  let current = "";
  const pushWord = (word: string) => {
    const attempt = current ? `${current} ${word}` : word;
    if (ctx.measureText(attempt).width <= maxWidth) {
      current = attempt;
      return;
    }
    if (current) {
      lines.push(current);
      current = "";
    }
    let chunk = "";
    for (const ch of word) {
      const next = chunk + ch;
      if (ctx.measureText(next).width <= maxWidth || !chunk) {
        chunk = next;
      } else {
        lines.push(chunk);
        chunk = ch;
      }
    }
    current = chunk;
  };
  for (const word of words) pushWord(word);
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

// wavelog icon mark, traced from frontend/src/components/Logo.tsx's <LogoMark> SVG
// (viewBox 0 0 40 28: two slanted bars + a dot -- no wordmark text, matching
// Receipt.tsx which renders the icon alone).
const LOGO_VIEWBOX = { w: 40, h: 28 };
const LOGO_BAR_A = [
  [2, 2],
  [10, 2],
  [17, 26],
  [9, 26],
];
const LOGO_BAR_B = [
  [14, 2],
  [22, 2],
  [29, 26],
  [21, 26],
];
const LOGO_DOT = { cx: 32.5, cy: 7.3, r: 5.3 };
const LOGO_RENDER_WIDTH = 56;
const LOGO_RENDER_HEIGHT = (LOGO_VIEWBOX.h * LOGO_RENDER_WIDTH) / LOGO_VIEWBOX.w;

/** Draws the wavelog icon mark centered horizontally, top edge at `topY`. */
function drawLogo(ctx: SKRSContext2D, topY: number): void {
  const scale = LOGO_RENDER_WIDTH / LOGO_VIEWBOX.w;
  const x0 = (WIDTH - LOGO_RENDER_WIDTH) / 2;
  const toPoint = ([px, py]: number[]): [number, number] => [x0 + px * scale, topY + py * scale];

  ctx.fillStyle = "#000000";
  for (const bar of [LOGO_BAR_A, LOGO_BAR_B]) {
    ctx.beginPath();
    bar.forEach((p, i) => {
      const [x, y] = toPoint(p);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
  }

  const [dotX, dotY] = toPoint([LOGO_DOT.cx, LOGO_DOT.cy]);
  ctx.beginPath();
  ctx.arc(dotX, dotY, LOGO_DOT.r * scale, 0, Math.PI * 2);
  ctx.fill();
}

/** Recreates the on-screen "영수증" receipt (Receipt.tsx) as a printable strip, so what's printed matches what the user saw. */
export function renderResultImage(artist: Artist): Buffer {
  const songs = [artist.mainSong, ...artist.similarSongs];
  const totalPlaytime = sumPlaytime(songs.map((s) => s.playtime));

  // Two-pass: measure on a scratch canvas first so we know the final height,
  // then draw for real (canvas can't be resized after creation).
  const measure = createCanvas(WIDTH, 10).getContext("2d");

  const TITLE_FONT = "bold 15px sans-serif";
  // Bolded (not just a plain small size) so small-text strokes keep enough
  // solid core after the printer's 1-bit threshold -- see printerProtocol.ts.
  const ARTIST_FONT = "bold 12px sans-serif";
  const ROW_LINE_HEIGHT = 17;
  const ROW_V_PADDING = 10;

  const rowLineCounts = songs.map((song) => {
    measure.font = TITLE_FONT;
    const titleLines = wrapText(measure, song.title, COLS[1].width - 4);
    measure.font = ARTIST_FONT;
    const artistLines = wrapText(measure, song.artist, COLS[2].width - 4);
    return Math.max(titleLines.length, artistLines.length, 1);
  });
  const rowHeights = rowLineCounts.map((n) => n * ROW_LINE_HEIGHT + ROW_V_PADDING * 2);

  measure.font = TITLE_FONT;
  const keywordLines = wrapText(measure, artist.keywords, COLS[1].width - 4);
  const totalRowHeight = Math.max(keywordLines.length, 1) * ROW_LINE_HEIGHT + 26;

  measure.font = "12px sans-serif";
  const footerText =
    "WAVELOG는 나의 음악 취향을 새로운 경험으로 이어주는 서비스입니다. " +
    "선택한 아티스트를 바탕으로 비슷한 아티스트와 곡을 담은 추천 리스트입니다. " +
    "추천곡을 감상하며 나와 잘 맞는 새로운 음악 취향을 발견해보세요.";
  const footerLines = wrapText(measure, footerText, WIDTH - PADDING * 2 - 16);
  const footerLineHeight = 17;
  const footerPadding = 12;
  const footerHeight = footerLines.length * footerLineHeight + footerPadding * 2;

  const height =
    PADDING + // top padding
    8 + // small gap before logo
    LOGO_RENDER_HEIGHT +
    16 + // gap after logo
    30 + // date row + its bottom border
    30 + // table head + its bottom border
    rowHeights.reduce((a, b) => a + b, 0) +
    totalRowHeight +
    16 + // gap before footer
    footerHeight +
    PADDING; // bottom padding

  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);

  let y = PADDING;

  y += 8;
  drawLogo(ctx, y);
  y += LOGO_RENDER_HEIGHT + 16;

  // DATE row
  ctx.textAlign = "left";
  ctx.fillStyle = "#000000";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("DATE", PADDING, y);
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText(todayDate(), PADDING + 40, y);
  ctx.textAlign = "right";
  ctx.fillStyle = "#000000";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("Wavelog", WIDTH - PADDING, y);
  y += 10;
  strokeLine(ctx, y, "solid");
  y += 20;

  // Table head
  ctx.textAlign = "left";
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "#555555";
  ctx.fillText("N.", COLS[0].x, y);
  ctx.fillText("SONG", COLS[1].x, y);
  ctx.fillText("ARTIST", COLS[2].x, y);
  ctx.fillText("PLAYTIME", COLS[3].x, y);
  y += 10;
  strokeLine(ctx, y, "dashed");
  y += 20;

  songs.forEach((song, i) => {
    const rowTop = y;
    const rowHeight = rowHeights[i];
    const textY = rowTop + ROW_V_PADDING + ROW_LINE_HEIGHT - 5;

    ctx.textAlign = "left";
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#000000";
    ctx.fillText(String(i + 1).padStart(2, "0"), COLS[0].x, textY);

    ctx.font = TITLE_FONT;
    ctx.fillStyle = "#000000";
    wrapText(ctx, song.title, COLS[1].width - 4).forEach((line, li) => {
      ctx.fillText(line, COLS[1].x, textY + li * ROW_LINE_HEIGHT);
    });

    ctx.font = ARTIST_FONT;
    ctx.fillStyle = "#666666";
    wrapText(ctx, song.artist, COLS[2].width - 4).forEach((line, li) => {
      ctx.fillText(line, COLS[2].x, textY + li * ROW_LINE_HEIGHT);
    });

    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#000000";
    ctx.fillText(song.playtime, COLS[3].x, textY);

    y = rowTop + rowHeight;
  });

  strokeLine(ctx, y, "dashed");
  y += 22;

  const totalTextY = y;
  ctx.textAlign = "left";
  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#666666";
  ctx.fillText("키워드", COLS[0].x, totalTextY);

  ctx.font = TITLE_FONT;
  ctx.fillStyle = "#666666";
  keywordLines.forEach((line, li) => {
    ctx.fillText(line, COLS[1].x, totalTextY + li * ROW_LINE_HEIGHT);
  });

  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#666666";
  ctx.fillText("총", COLS[2].x, totalTextY);

  ctx.font = "bold 13px sans-serif";
  ctx.fillStyle = "#000000";
  ctx.fillText(totalPlaytime, COLS[3].x, totalTextY);

  y += totalRowHeight - 10;
  strokeLine(ctx, y, "solid");
  y += 16;

  // Footer band
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(PADDING, y, CONTENT_WIDTH, footerHeight);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "11px sans-serif";
  footerLines.forEach((line, li) => {
    ctx.fillText(line, WIDTH / 2, y + footerPadding + (li + 1) * footerLineHeight - 5);
  });

  return canvas.toBuffer("image/png");
}

function strokeLine(ctx: SKRSContext2D, y: number, style: "solid" | "dashed"): void {
  ctx.strokeStyle = "#a3a3a3";
  ctx.lineWidth = style === "solid" ? 1.5 : 1;
  ctx.setLineDash(style === "dashed" ? [4, 3] : []);
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** "mm:ss" strings -> their sum, also "mm:ss" (mirrors frontend's data/artists.ts sumPlaytime). */
function sumPlaytime(playtimes: string[]): string {
  const totalSeconds = playtimes.reduce((acc, p) => {
    const [m, s] = p.split(":").map(Number);
    return acc + m * 60 + s;
  }, 0);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function renderResultImageBase64(artist: Artist): string {
  return renderResultImage(artist).toString("base64");
}

/** Simple centered-text strip, for a printer connectivity smoke test (e.g. "안녕"). */
export function renderTextImage(text: string): Buffer {
  const height = 160;
  const canvas = createCanvas(WIDTH, height);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 48px sans-serif";
  ctx.fillText(text, WIDTH / 2, height / 2);

  return canvas.toBuffer("image/png");
}

export function renderTextImageBase64(text: string): string {
  return renderTextImage(text).toString("base64");
}
