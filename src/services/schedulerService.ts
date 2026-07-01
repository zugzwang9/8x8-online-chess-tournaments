import { prisma } from "../config/prisma";
import { generateGladiatorPairings } from "./pairingService";
import { enforceRoundTimeouts } from "./tournamentSupervisor";
import { provisionUpcomingTournaments } from "./tournamentProvisionerService";
import { attachLichessGamesToMatches, checkActiveGames } from "./lichessMatchService";

let intervalId: NodeJS.Timeout | null = null;

const CHECK_INTERVAL_MS = 30 * 1000; // run every 30 seconds

export const startScheduler = async (): Promise<void> => {
  if (intervalId) return;

  // Provision upcoming tournaments immediately on scheduler start
  try {
    await provisionUpcomingTournaments();
  } catch (err) {
    console.error(
      "[scheduler] Error during initial tournament provisioning:",
      err instanceof Error ? err.message : err
    );
  }

  intervalId = setInterval(async () => {
    // Step 0: Provision upcoming tournaments
    try {
      await provisionUpcomingTournaments();
    } catch (err) {
      console.error(
        "[scheduler] Error provisioning tournaments in interval:",
        err instanceof Error ? err.message : err
      );
    }

    // ── 1. Auto-start tournaments whose registration has closed ───────────
    try {
      const now = new Date();
      const due = await prisma.tournament.findMany({
        where: {
          status: "UPCOMING",
          registrationClosesAt: { lte: now },
          currentRound: 0
        }
      });

      for (const tournament of due) {
        try {
          console.log(
            `[scheduler] Starting tournament ${tournament.id} as registration closed at ${tournament.registrationClosesAt}`
          );
          // Purge all no-shows before starting the tournament
          await prisma.tournamentParticipant.deleteMany({
            where: { tournamentId: tournament.id, checkedIn: false }
          });
          const count = await prisma.tournamentParticipant.count({
            where: { tournamentId: tournament.id }
          });
          if (count < 2) {
            console.log(`[scheduler] Cancelling tournament ${tournament.id} due to insufficient checked-in participants.`);
            await prisma.tournament.update({
              where: { id: tournament.id },
              data: { status: "FINISHED" }
            });
            continue;
          }
          const pairings = await generateGladiatorPairings(tournament.id);
          await attachLichessGamesToMatches(pairings.matches.map((match) => match.id));
        } catch (err) {
          console.error(
            `[scheduler] Failed to start tournament ${tournament.id}:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    } catch (err) {
      console.error("[scheduler] Error checking tournaments:", err instanceof Error ? err.message : err);
    }

    // ── 2. Poll Lichess for finished games (runs every 30s) ─────────────
    try {
      const { checked, completed } = await checkActiveGames();
      if (completed > 0) {
        console.log(`[scheduler] checkActiveGames: ${completed}/${checked} game(s) completed.`);
      }
    } catch (err) {
      console.error("[scheduler] checkActiveGames error:", err instanceof Error ? err.message : err);
    }

    // ── 3. Enforce 15-minute round timeouts ───────────────────────────────
    try {
      await enforceRoundTimeouts();
    } catch (err) {
      console.error("[scheduler] enforceRoundTimeouts error:", err instanceof Error ? err.message : err);
    }
  }, CHECK_INTERVAL_MS);
};

export const stopScheduler = (): void => {
  if (!intervalId) return;
  clearInterval(intervalId);
  intervalId = null;
};

