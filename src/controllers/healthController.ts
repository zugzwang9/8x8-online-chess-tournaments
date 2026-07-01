import type { Request, Response } from "express";

export const getHealth = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    status: "ok",
    service: "online-chess-tournament-api"
  });
};
