import { Router } from "express";
import type { CreatePrintJobRequest, CreatePrintJobResponse, DequeuePrintJobResponse } from "@festival-nfc/shared";
import { getArtist } from "../services/artistStore";
import { getSession, setSelectedArtist } from "../services/sessionStore";
import { dequeueNextJob, enqueueJob, getJob, getJobBySession, listRecentJobs, markJobCompleted, markJobFailed, queuePosition, retryJob } from "../services/printQueue";
import { getResultImageBase64 } from "../services/resultImageStore";
import { requireAdminToken } from "../middleware/requireAdminToken";
import { writeEndpointLimiter } from "../middleware/rateLimit";
import { getAdminHeartbeat, recordAdminHeartbeat } from "../services/adminHeartbeat";

export const printJobsRouter = Router();

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
    artistName: getArtist(job.artistId)?.name ?? job.artistId,
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
