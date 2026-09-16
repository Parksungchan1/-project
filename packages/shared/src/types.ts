// Domain types shared between server and admin-client.
// The user-facing frontend (built separately) can also import this package
// if it's set up as part of the same workspace later.

export interface Artist {
  id: string;
  name: string;
  imageUrl: string;
  audioPreviewUrl: string;
}

export interface SimilarArtist {
  id: string;
  name: string;
  imageUrl: string;
  reason?: string; // e.g. "비슷한 장르", short blurb shown under the name
}

export interface ArtistDetail extends Artist {
  similarArtists: SimilarArtist[];
}

export interface Session {
  id: string;
  createdAt: string; // ISO timestamp
  selectedArtistId?: string;
}

export type PrintJobStatus = "pending" | "in_progress" | "completed" | "failed";

export interface PrintJob {
  id: string;
  sessionId: string;
  artistId: string;
  status: PrintJobStatus;
  /** Base64-encoded PNG of the rendered result strip (48mm-width layout). */
  imageBase64: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrintJobRequest {
  sessionId: string;
  artistId: string;
}

export interface CreatePrintJobResponse {
  jobId: string;
  queuePosition: number;
}

export interface DequeuePrintJobResponse {
  job: PrintJob | null;
}
