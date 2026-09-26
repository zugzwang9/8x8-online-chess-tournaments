import { Router } from "express";
import { getCurrentUser, lichessCallback, lichessLogin, logout } from "./auth.controller";
import { requireAuth } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import rateLimit from "express-rate-limit";

export const authRoutes = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: "Too many login attempts, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

authRoutes.use("/lichess", authLimiter);

authRoutes.get("/lichess", asyncHandler(lichessLogin));
authRoutes.get("/lichess/callback", asyncHandler(lichessCallback));
authRoutes.get("/me", requireAuth, asyncHandler(getCurrentUser));
authRoutes.post("/logout", asyncHandler(logout));
