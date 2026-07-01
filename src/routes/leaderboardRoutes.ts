import { Router } from "express";
import { getGlobalLeaderboard } from "../controllers/leaderboardController";
import { asyncHandler } from "../utils/asyncHandler";

export const leaderboardRoutes = Router();

leaderboardRoutes.get("/", asyncHandler(getGlobalLeaderboard));
