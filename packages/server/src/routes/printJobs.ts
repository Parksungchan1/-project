import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { CreatePrintJobRequest, CreatePrintJobResponse, DequeuePrintJobResponse } from "@festival-nfc/shared";
import { getArtist } from "../services/artistStore";
import { getSession, setSelectedArtist } from "../services/sessionStore";
import { dequeueNextJob, enqueueJob, getJob, getJobBySession, listRecentJobs, markJobCompleted, markJobFailed, queuePosition, retryJob } from "../services/printQueue";
import { getResultImageBase64 } from "../services/resultImageStore";
import { renderTextImageBase64 } from "../services/resultImage";
import { requireAdminToken } from "../middleware/requireAdminToken";
import { writeEndpointLimiter } from "../middleware/rateLimit";
import { getAdminHeartbeat, recordAdminHeartbeat } from "../services/adminHeartbeat";

export const printJobsRouter = Router();

// Sentinel artistId for /print-jobs/test-print jobs -- not a real artist, so
// getArtist() below returns undefined and the admin page falls back to a
// friendly label instead of showing this raw id.
const TEST_ARTIST_ID = "__test__";

// --- User-facing: create a print job from the phone webapp ---
printJobsRouter.post("/print-jobs", writeEndpointLimiter, (req, res) => {
  const { sessionId, artistId } = req.body as CreatePrintJobRequest;

  const session = getSession(sessionId);
  if (!session) {
    res.status(404).json({ error: "session not found" });
    return;
  }
  const artist = getArtist(artistId);
  if (!artist) {
    res.status(404).json({ error: "artist not found" });
    return;
  }

  // One tap == one session == one print. Repeated calls (double/triple-click,
  // a retried fetch, or someone hitting the endpoint directly) return the
  // same job instead of enqueueing duplicates -- this holds even if a caller
  // bypasses the UI's own debounce entirely.
  const existing = getJobBySession(sessionId);
  if (existing) {
    const response: CreatePrintJobResponse = { jobId: existing.id, queuePosition: queuePosition(existing.id) };
    res.status(200).json(response);
    return;
  }

  setSelectedArtist(sessionId, artistId);
  // Same 9 artists -> same 9 result strips, so we hand out the pre-resolved
  // image instead of re-rendering one per request.
  const imageBase64 = getResultImageBase64(artistId);
  const job = enqueueJob(sessionId, artistId, imageBase64);

  const response: CreatePrintJobResponse = {
    jobId: job.id,
    queuePosition: queuePosition(job.id),
  };
  res.status(201).json(response);
});

// --- Admin-only: printer connectivity smoke test, no NFC/session needed.
// Renders short text (default "안녕") to an image and drops it in the same
// queue admin-client already polls, so it exercises the real print path.
printJobsRouter.post("/print-jobs/test-print", requireAdminToken, (req, res) => {
  const body = req.body as { text?: unknown } | undefined;
  const text = typeof body?.text === "string" && body.text.trim() ? body.text.trim().slice(0, 20) : "안녕";
  const imageBase64 = renderTextImageBase64(text);
  const job = enqueueJob(`test-${randomUUID()}`, TEST_ARTIST_ID, imageBase64);
  const response: CreatePrintJobResponse = { jobId: job.id, queuePosition: queuePosition(job.id) };
  res.status(201).json(response);
});

// --- Admin-only: the booth laptop polls/acts on these ---
printJobsRouter.post("/print-jobs/dequeue", requireAdminToken, (_req, res) => {
  recordAdminHeartbeat(); // admin-client's automatic loop hits this every poll cycle
  const job = dequeueNextJob();
  const response: DequeuePrintJobResponse = { job };
  res.json(response);
});

printJobsRouter.post("/print-jobs/:id/complete", requireAdminToken, (req, res) => {
  const job = markJobCompleted(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json(job);
});

printJobsRouter.post("/print-jobs/:id/fail", requireAdminToken, (req, res) => {
  const job = markJobFailed(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json(job);
});

// --- Admin monitor page: read-only log of recent requests, no action taken here.
// Actual printing is triggered automatically by admin-client's polling loop,
// not by anyone viewing this page.
printJobsRouter.get("/print-jobs", requireAdminToken, (_req, res) => {
  const jobs = listRecentJobs().map((job) => ({
    ...job,
    imageBase64: undefined, // too big for a log list; strip it out
    artistName: job.artistId === TEST_ARTIST_ID ? "테스트 인쇄" : (getArtist(job.artistId)?.name ?? job.artistId),
  }));
  res.json({ jobs, adminClientLastSeen: getAdminHeartbeat() });
});

// Failed job (Bluetooth drop, printer offline, etc.) -> put it back in the
// queue so admin-client's normal automatic loop picks it up again. This is
// the one action the admin page is allowed to trigger -- it doesn't print
// anything itself, it just re-enters the same automatic pipeline.
printJobsRouter.post("/print-jobs/:id/retry", requireAdminToken, (req, res) => {
  const job = retryJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found or not in failed state" });
    return;
  }
  res.json(job);
});

printJobsRouter.get("/print-jobs/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "job not found" });
    return;
  }
  res.json(job);
});
