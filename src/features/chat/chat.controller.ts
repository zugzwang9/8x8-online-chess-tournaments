import type { Request, Response } from "express";
import { HttpError } from "../../utils/httpError";
import { getMessages, addMessage, isRateLimited } from "./chat.service";
import { z } from "zod";

export const getChat = async (req: Request, res: Response): Promise<void> => {
  const tournamentId = req.query.tournamentId as string;
  if (!tournamentId) throw new HttpError(400, "tournamentId is required");
  res.json({ messages: getMessages(tournamentId) });
};

export const sendChat = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated.");
  }

  if (isRateLimited(req.user.lichessUsername)) {
    throw new HttpError(429, "Please wait a few seconds before sending another message.");
  }

  const parsed = z.object({
    message: z.string().trim().min(1, "Message cannot be empty."),
    tournamentId: z.string().uuid("tournamentId must be a valid UUID")
  }).safeParse(req.body);

  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues[0].message);
  }

  const { message: trimmed, tournamentId } = parsed.data;

  if (trimmed.length > 300) {
    throw new HttpError(400, "Message cannot exceed 300 characters.");
  }

  addMessage(tournamentId, req.user.lichessUsername, trimmed);

  res.json({ messages: getMessages(tournamentId) });
};
