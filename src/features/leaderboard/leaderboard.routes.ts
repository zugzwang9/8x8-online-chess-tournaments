import { Router } from "express";
import { getGlobalLeaderboard } from "./leaderboard.controller";
import { asyncHandler } from "../../utils/asyncHandler";

export const leaderboardRoutes = Router();

leaderboardRoutes.get("/", asyncHandler(getGlobalLeaderboard));
