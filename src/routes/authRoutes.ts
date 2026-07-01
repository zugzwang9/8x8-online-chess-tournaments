import { Router } from "express";
import { getCurrentUser, lichessCallback, lichessLogin, logout } from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

export const authRoutes = Router();

authRoutes.get("/lichess", asyncHandler(lichessLogin));
authRoutes.get("/lichess/callback", asyncHandler(lichessCallback));
authRoutes.get("/me", requireAuth, asyncHandler(getCurrentUser));
authRoutes.post("/logout", asyncHandler(logout));
