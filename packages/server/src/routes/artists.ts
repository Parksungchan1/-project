import { Router } from "express";
import { getArtist, listArtists } from "../services/artistStore";

export const artistsRouter = Router();

artistsRouter.get("/artists", (_req, res) => {
  // The webapp fetches the full list once and caches it, using it for both
  // the card screen and the result screen -- so this returns everything.
  res.json(listArtists());
});

artistsRouter.get("/artists/:id", (req, res) => {
  const artist = getArtist(req.params.id);
  if (!artist) {
    res.status(404).json({ error: "artist not found" });
    return;
  }
  res.json(artist);
});
