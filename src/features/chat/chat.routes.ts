import { Router } from "express";
import { getChat, sendChat } from "./chat.controller";
import { requireAuth } from "../../middleware/authMiddleware";
import { asyncHandler } from "../../utils/asyncHandler";

export const chatRoutes = Router();

chatRoutes.get("/", asyncHandler(getChat));
chatRoutes.post("/", requireAuth, asyncHandler(sendChat));
