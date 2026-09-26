import { Router } from "express";
import { getHealth } from "./health.controller";
import { asyncHandler } from "../../utils/asyncHandler";

export const healthRoutes = Router();

healthRoutes.get("/", asyncHandler(getHealth));
