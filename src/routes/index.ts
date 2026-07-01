import { Router } from "express";
import { adminRoutes } from "./adminRoutes";
import { authRoutes } from "./authRoutes";
import { chatRoutes } from "./chatRoutes";
import { healthRoutes } from "./healthRoutes";
import { lichessWebhookRoutes } from "./lichessWebhookRoutes";
import { matchRoutes } from "./matchRoutes";
import { tournamentRoutes } from "./tournamentRoutes";
import { userRoutes } from "./userRoutes";
import { leaderboardRoutes } from "./leaderboardRoutes";

export const routes = Router();

routes.use("/health", healthRoutes);
routes.use("/auth", authRoutes);
routes.use("/tournaments", tournamentRoutes);
routes.use("/matches", matchRoutes);
routes.use("/admin", adminRoutes);
routes.use("/users", userRoutes);
routes.use("/webhooks", lichessWebhookRoutes);
routes.use("/chat", chatRoutes);
routes.use("/leaderboard", leaderboardRoutes);


