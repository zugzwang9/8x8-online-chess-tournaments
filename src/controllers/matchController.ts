import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";

// Handles the 'Play Match' action by marking a player as joined.
export const joinCheckMatch = async (req: Request, res: Response): Promise<void> => {
  const matchId = String(req.params.id);

  if (!req.user) {
    throw new HttpError(401, "Not authenticated.");
  }

  const userId = req.user.sub;

  const match = await prisma.match.findUnique({
    where: { id: matchId }
  });

  if (!match) {
    throw new HttpError(404, "Match not found.");
  }

  const isWhite = match.whitePlayerId === userId;
  const isBlack = match.blackPlayerId === userId;

  if (!isWhite && !isBlack) {
    throw new HttpError(403, "You are not a player in this match.");
  }

  await prisma.match.update({
    where: { id: matchId },
    data: isWhite ? { whiteJoined: true } : { blackJoined: true }
  });

  res.status(200).json({ ok: true });
};
