// Domain types shared between server and admin-client.
// The user-facing frontend (built separately) can also import this package
// if it's set up as part of the same workspace later.

export interface Song {
  title: string;
  artist: string;
  /** "mm:ss" format, e.g. "03:20" */
  playtime: string;
  coverUrl: string;
  /** true if coverUrl already has the title/artist text baked into the image */
  coverHasText?: boolean;
}

export interface Artist {
  id: string;
  name: string;
  /** short label for the "재생중..." caption when name is too long to fit */
  shortName?: string;
  /** e.g. "DAY 1 · 126 스테이지" */
  stage: string;
  /** up to 3 short tags shown on the artist card */
  tags: string[];
  imageUrl: string;
  /** YouTube video id (the v= param) of the official upload of mainSong -- played in a hidden player as background audio. */
  youtubeVideoId: string;
  mainSong: Song;
  /** similar songs shown on the result screen and printed on the receipt */
  similarSongs: Song[];
  /** short blurb printed on the receipt, e.g. "여자 솔로 / 인디" */
  keywords: string;
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
