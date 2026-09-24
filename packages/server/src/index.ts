import cors from "cors";
import express from "express";
import { join } from "node:path";
import { sessionRouter } from "./routes/session";
import { artistsRouter } from "./routes/artists";
import { printJobsRouter } from "./routes/printJobs";
import { initResultImageCache } from "./services/resultImageStore";

initResultImageCache();

const app = express();
// Cloud hosts (Railway/Render/etc.) sit behind a reverse proxy -- without
// this, express-rate-limit sees the proxy's IP for every request instead of
// the real client's, making the per-IP limiter useless.
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
// test.html: throwaway signal-testing harness, not the real UI (that's built
// separately). NFC tag can point straight at /test.html to verify tap-to-open.
app.use(express.static(join(__dirname, "..", "public")));
// Artist photos/album art/audio previews, referenced by artists.json as /media/... .
app.use("/media", express.static(join(__dirname, "..", "assets", "media")));

app.use("/api", sessionRouter);
app.use("/api", artistsRouter);
app.use("/api", printJobsRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`server listening on :${PORT}`);
});
