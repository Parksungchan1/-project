import { randomUUID } from "node:crypto";
import type { PrintJob } from "@festival-nfc/shared";

// In-memory FIFO queue. A single admin device dequeues jobs one at a time,
// so a plain array + mutex-free atomic splice is enough for this scale.
// If the process needs to survive a crash mid-event, persist `jobs` to a
// JSON file on every mutation instead of swapping to a database.
const jobs = new Map<string, PrintJob>();
const pendingOrder: string[] = [];

export function enqueueJob(sessionId: string, artistId: string, imageBase64: string): PrintJob {
  const now = new Date().toISOString();
  const job: PrintJob = {
    id: randomUUID(),
    sessionId,
    artistId,
    status: "pending",
    imageBase64,
    createdAt: now,
    updatedAt: now,
  };
  jobs.set(job.id, job);
  pendingOrder.push(job.id);
  return job;
}

export function queuePosition(jobId: string): number {
  return pendingOrder.indexOf(jobId);
}

/** Atomically pulls the oldest pending job and marks it in_progress. */
export function dequeueNextJob(): PrintJob | null {
  const jobId = pendingOrder.shift();
  if (!jobId) return null;
  const job = jobs.get(jobId);
  if (!job) return null;
  job.status = "in_progress";
  job.updatedAt = new Date().toISOString();
  return job;
}

export function markJobCompleted(jobId: string): PrintJob | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.status = "completed";
  job.updatedAt = new Date().toISOString();
  return job;
}

/** Puts the job back to the front of the pending queue for a retry. */
export function markJobFailed(jobId: string): PrintJob | undefined {
  const job = jobs.get(jobId);
  if (!job) return undefined;
  job.status = "failed";
  job.updatedAt = new Date().toISOString();
  return job;
}

export function getJob(jobId: string): PrintJob | undefined {
  return jobs.get(jobId);
}

/** Most recent jobs first, for the admin monitor page. */
export function listRecentJobs(limit = 50): PrintJob[] {
  return [...jobs.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Re-queues a failed job so admin-client's automatic loop picks it up again. */
export function retryJob(jobId: string): PrintJob | undefined {
  const job = jobs.get(jobId);
  if (!job || job.status !== "failed") return undefined;
  job.status = "pending";
  job.updatedAt = new Date().toISOString();
  pendingOrder.push(job.id);
  return job;
}
