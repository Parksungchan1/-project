import { Router } from "express";
import { getArtist, listArtists } from "../services/artistStore";

export const artistsRouter = Router();

artistsRouter.get("/artists", (_req, res) => {
  // Card screen only needs id/name/image/audio, not the similar-artist list.
  const artists = listArtists().map(({ id, name, imageUrl, audioPreviewUrl }) => ({
    id,
    name,
    imageUrl,
    audioPreviewUrl,
  }));
  res.json(artists);
});

artistsRouter.get("/artists/:id", (req, res) => {
  const artist = getArtist(req.params.id);
  if (!artist) {
    res.status(404).json({ error: "artist not found" });
    return;
  }
  res.json(artist);
});
