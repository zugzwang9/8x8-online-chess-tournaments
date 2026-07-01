import { Router } from "express";
import { getHealth } from "../controllers/healthController";
import { asyncHandler } from "../utils/asyncHandler";

export const healthRoutes = Router();

healthRoutes.get("/", asyncHandler(getHealth));
