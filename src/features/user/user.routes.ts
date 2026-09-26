import { Router } from "express";
import { requireAuth } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";
import { getUserProfile, updateBio } from "./user.controller";

export const userRoutes = Router();

// Defines user profile and bio management routes.
userRoutes.get("/:username", asyncHandler(getUserProfile));
userRoutes.put("/profile/bio", requireAuth, asyncHandler(updateBio));
