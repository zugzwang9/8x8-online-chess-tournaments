import type { Request, Response } from "express";
import { checkActiveGames } from "./lichessMatch.service";

export const checkLichessActiveGames = async (_req: Request, res: Response): Promise<void> => {
  const result = await checkActiveGames();
  res.json(result);
};
