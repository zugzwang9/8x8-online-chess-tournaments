import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";
import { joinCheckMatch } from "../controllers/matchController";

export const matchRoutes = Router();

// Called by the frontend the moment a player clicks "Play Match".
// Sets whiteJoined / blackJoined on the match so the timeout enforcer
// can distinguish attendance scenarios.
matchRoutes.post("/:id/join-check", requireAuth, asyncHandler(joinCheckMatch));
