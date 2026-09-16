import { Router } from "express";
import { createSession } from "../services/sessionStore";
import { writeEndpointLimiter } from "../middleware/rateLimit";

export const sessionRouter = Router();

// Called once when the user-facing webapp loads (after NFC tap opens the URL).
sessionRouter.post("/session", writeEndpointLimiter, (_req, res) => {
  const session = createSession();
  res.status(201).json(session);
});
