import { Router } from "express";
import { adminRoutes } from "../features/admin/admin.routes";
import { authRoutes } from "../features/auth/auth.routes";
import { chatRoutes } from "../features/chat/chat.routes";
import { healthRoutes } from "../features/health/health.routes";
import { lichessWebhookRoutes } from "../features/match/lichessWebhook.routes";
import { matchRoutes } from "../features/match/match.routes";
import { tournamentRoutes } from "../features/tournament/tournament.routes";
import { userRoutes } from "../features/user/user.routes";
import { leaderboardRoutes } from "../features/leaderboard/leaderboard.routes";

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


