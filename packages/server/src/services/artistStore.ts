import type { Artist } from "@festival-nfc/shared";
import artistsData from "../data/artists.json";

const artists = artistsData as Artist[];

export function listArtists(): Artist[] {
  return artists;
}

export function getArtist(id: string): Artist | undefined {
  return artists.find((a) => a.id === id);
}
