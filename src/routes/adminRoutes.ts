import { Router } from "express";
import { requireAdmin } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { fastForwardRound, seedTestPlayers, retryLichessGames } from "../controllers/adminController";

export const adminRoutes = Router();

// Admin endpoints for testing and tournament management. Require JWT authentication.
adminRoutes.post("/tournaments/:id/seed-test-players", requireAdmin, asyncHandler(seedTestPlayers));
adminRoutes.post("/tournaments/:id/fast-forward",      requireAdmin, asyncHandler(fastForwardRound));
adminRoutes.post("/tournaments/:id/retry-lichess", requireAdmin, asyncHandler(retryLichessGames));
