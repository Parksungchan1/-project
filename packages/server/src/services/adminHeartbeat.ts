// Tracks whether the booth laptop's admin-client is actually alive and
// polling. Recorded every time it calls dequeue (the only endpoint it hits
// automatically on every poll cycle) -- not touched by admin.html's own
// read-only polling, so this reflects the real Bluetooth bridge process,
// not just someone having the monitor page open.
let lastSeenAt: string | null = null;

export function recordAdminHeartbeat(): void {
  lastSeenAt = new Date().toISOString();
}

export function getAdminHeartbeat(): string | null {
  return lastSeenAt;
}
