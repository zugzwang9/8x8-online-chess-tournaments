import { Router } from "express";
import { checkLichessActiveGames } from "../controllers/lichessWebhookController";
import { requireAuth } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

export const lichessWebhookRoutes = Router();

lichessWebhookRoutes.post("/lichess-game-end", requireAuth, asyncHandler(checkLichessActiveGames));
