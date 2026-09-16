import type { NextFunction, Request, Response } from "express";

// Cheap shared-secret check so a random visitor can't drain the print queue
// or spoof "job completed" calls. Fine for a single-booth demo; upgrade to
// per-device tokens only if multiple admin devices need independent access.
export function requireAdminToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.header("x-admin-token");
  if (!process.env.ADMIN_TOKEN) {
    // Not configured yet (local dev) -> don't lock the developer out.
    next();
    return;
  }
  if (token !== process.env.ADMIN_TOKEN) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}
