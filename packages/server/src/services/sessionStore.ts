import { randomUUID } from "node:crypto";
import type { Session } from "@festival-nfc/shared";

// In-memory session store. Fine for a single-booth demo; sessions don't need
// to survive a server restart. Swap for Redis/DB only if that changes.
const sessions = new Map<string, Session>();

export function createSession(): Session {
  const session: Session = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function setSelectedArtist(sessionId: string, artistId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  session.selectedArtistId = artistId;
  return session;
}
