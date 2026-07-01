import type { Request, Response } from "express";
import { HttpError } from "../utils/httpError";
import { getMessages, addMessage, isRateLimited } from "../services/chatService";

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

  const { message, tournamentId } = req.body;

  if (!tournamentId) throw new HttpError(400, "tournamentId is required");

  if (typeof message !== "string") {
    throw new HttpError(400, "Message must be a string.");
  }

  const trimmed = message.trim();
  if (!trimmed) {
    throw new HttpError(400, "Message cannot be empty.");
  }

  if (trimmed.length > 300) {
    throw new HttpError(400, "Message cannot exceed 300 characters.");
  }

  addMessage(tournamentId, req.user.lichessUsername, trimmed);

  res.json({ messages: getMessages(tournamentId) });
};
