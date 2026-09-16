import rateLimit from "express-rate-limit";

// Defense-in-depth against someone hitting the public endpoints directly
// (curl/script), bypassing whatever debounce the real UI adds. Session-level
// idempotency (see printQueue.getJobBySession) already caps one session to
// one print job; this catches the case of spinning up many sessions instead.
// Generous enough that a cluster of real visitors behind the same booth/venue
// NAT won't trip it.
export const writeEndpointLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "too many requests, slow down" },
});
