import { Router } from "express";
import {
  advanceToNextRound,
  createTournament,
  getTournamentLive,
  getTournamentStandings,
  joinTournament,
  leaveTournament,
  listTournaments,
  startTournament,
  stopTournament,
  getUpcomingTournament,
  checkInTournament
} from "../controllers/tournamentController";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware";
import { asyncHandler } from "../utils/asyncHandler";

export const tournamentRoutes = Router();

tournamentRoutes.get("/", asyncHandler(listTournaments));
tournamentRoutes.post("/", requireAdmin, asyncHandler(createTournament));
// Return the next upcoming tournament (used by frontend to find the scheduled Sunday event)
tournamentRoutes.get("/upcoming", asyncHandler(getUpcomingTournament));
tournamentRoutes.get("/:id", asyncHandler(getTournamentLive));
tournamentRoutes.post("/:id/join", requireAuth, asyncHandler(joinTournament));
tournamentRoutes.post("/:id/leave", requireAuth, asyncHandler(leaveTournament));
tournamentRoutes.post("/:id/checkin", requireAuth, asyncHandler(checkInTournament));
tournamentRoutes.post("/:id/start", requireAdmin, asyncHandler(startTournament));
tournamentRoutes.post("/:id/stop", requireAdmin, asyncHandler(stopTournament));
tournamentRoutes.post("/:id/next-round", requireAdmin, asyncHandler(advanceToNextRound));
tournamentRoutes.get("/:id/standings", asyncHandler(getTournamentStandings));
