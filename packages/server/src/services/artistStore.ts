import type { ArtistDetail } from "@festival-nfc/shared";
import artistsData from "../data/artists.json";

const artists = artistsData as ArtistDetail[];

export function listArtists(): ArtistDetail[] {
  return artists;
}

export function getArtist(id: string): ArtistDetail | undefined {
  return artists.find((a) => a.id === id);
}
