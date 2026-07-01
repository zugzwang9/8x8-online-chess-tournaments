import { Router } from "express";
import { getChat, sendChat } from "../controllers/chatController";
import { requireAuth } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

export const chatRoutes = Router();

chatRoutes.get("/", asyncHandler(getChat));
chatRoutes.post("/", requireAuth, asyncHandler(sendChat));
