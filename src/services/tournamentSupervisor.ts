import { MatchResult, MatchStatus, ParticipantStatus, TournamentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { generateGladiatorPairings } from "./pairingService";
import { attachLichessGamesToMatches, fetchLichessGameResult } from "./lichessMatchService";
import { clearChat } from "./chatService";
import { provisionUpcomingTournaments } from "./tournamentProvisionerService";

// Maximum wall-clock time allowed per round (15 minutes), overridable via env.
const ROUND_TIMEOUT_MS = Number(process.env.ROUND_TIMEOUT_MS ?? 15 * 60 * 1000);

// Timeout resolution helpers
type StaleMatch = {
  id: string;
  tournamentId: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whiteJoined: boolean;
  blackJoined: boolean;
  lichessGameId: string | null;
};

/** Deduct lives / award points for one participant and update their status. */
const adjustParticipant = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  tournamentId: string,
  userId: string,
  liveDelta: number,
  pointDelta: number,
  forfeitAction: "INCREMENT" | "RESET" | "NONE" = "NONE"
): Promise<void> => {
  const p = await tx.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId, userId } }
  });
  if (!p) return;
  const lives = Math.max(0, p.lives + liveDelta);
  
  let newConsecutiveForfeits = p.consecutiveForfeits;
  if (forfeitAction === "INCREMENT") newConsecutiveForfeits += 1;
  else if (forfeitAction === "RESET") newConsecutiveForfeits = 0;

  const isEliminated = lives === 0 || newConsecutiveForfeits >= 2;

  await tx.tournamentParticipant.update({
    where: { id: p.id },
    data: {
      lives,
      consecutiveForfeits: newConsecutiveForfeits,
      points: pointDelta !== 0 ? { increment: pointDelta } : undefined,
      status: isEliminated ? ParticipantStatus.ELIMINATED : ParticipantStatus.ACTIVE
    }
  });
};

/** Apply Lichess result directly. */
const applyNormalResult = async (
  match: StaleMatch,
  result: MatchResult,
  forfeitedPlayerId: string | null,
  now: Date
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { result, status: MatchStatus.COMPLETED, forfeitedPlayerId, processedAt: now }
    });

    const getForfeitAction = (playerId: string) => {
      if (result === MatchResult.FORFEIT) {
         return playerId === forfeitedPlayerId ? "INCREMENT" : "RESET";
      }
      return "RESET"; // Real games reset the counter.
    };

    if (result === MatchResult.WHITE_WIN || (result === MatchResult.FORFEIT && forfeitedPlayerId === match.blackPlayerId)) {
      await adjustParticipant(tx, match.tournamentId, match.whitePlayerId, 0, 1, getForfeitAction(match.whitePlayerId));
      await adjustParticipant(tx, match.tournamentId, match.blackPlayerId, -1, 0, getForfeitAction(match.blackPlayerId));
    } else if (result === MatchResult.BLACK_WIN || (result === MatchResult.FORFEIT && forfeitedPlayerId === match.whitePlayerId)) {
      await adjustParticipant(tx, match.tournamentId, match.blackPlayerId, 0, 1, getForfeitAction(match.blackPlayerId));
      await adjustParticipant(tx, match.tournamentId, match.whitePlayerId, -1, 0, getForfeitAction(match.whitePlayerId));
    } else if (result === MatchResult.DRAW) {
      await adjustParticipant(tx, match.tournamentId, match.whitePlayerId, -0.5, 0.5, "RESET");
      await adjustParticipant(tx, match.tournamentId, match.blackPlayerId, -0.5, 0.5, "RESET");
    }
  });
};

/** Scenario B: Neither player joined — double forfeit. */
const applyDoubleForfeit = async (match: StaleMatch, now: Date): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { result: MatchResult.FORFEIT, status: MatchStatus.COMPLETED, processedAt: now }
    });
    await adjustParticipant(tx, match.tournamentId, match.whitePlayerId, -1, 0, "INCREMENT");
    await adjustParticipant(tx, match.tournamentId, match.blackPlayerId, -1, 0, "INCREMENT");
  });
};

/** Scenario A: One player joined, the other did not. */
const applySingleForfeit = async (
  match: StaleMatch,
  absentId: string,
  presentId: string,
  now: Date
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        result: MatchResult.FORFEIT,
        status: MatchStatus.COMPLETED,
        forfeitedPlayerId: absentId,
        processedAt: now
      }
    });
    await adjustParticipant(tx, match.tournamentId, presentId, 0, 1, "RESET");
    await adjustParticipant(tx, match.tournamentId, absentId, -1, 0, "INCREMENT");
  });
};

/** Scenario C: Both players joined but game never officially started (technical draw). */
const applyAttendanceDraw = async (match: StaleMatch, now: Date): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { result: MatchResult.DRAW, status: MatchStatus.COMPLETED, processedAt: now }
    });
    await adjustParticipant(tx, match.tournamentId, match.whitePlayerId, -0.5, 0, "RESET");
    await adjustParticipant(tx, match.tournamentId, match.blackPlayerId, -0.5, 0, "RESET");
  });
};

/** Scenario D: Infrastructure failure — game was never created on Lichess. */
const applyServerFailureDraw = async (match: StaleMatch, now: Date): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: { result: MatchResult.DRAW, status: MatchStatus.COMPLETED, processedAt: now }
    });
    await adjustParticipant(tx, match.tournamentId, match.whitePlayerId, 0, 0.5, "RESET");
    await adjustParticipant(tx, match.tournamentId, match.blackPlayerId, 0, 0.5, "RESET");
  });
};

// Internal helpers
/** Finalises the tournament when maxRounds is reached. */
const finaliseTournament = async (tournamentId: string): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    // Crown survivors
    await tx.tournamentParticipant.updateMany({
      where: {
        tournamentId,
        status: ParticipantStatus.ACTIVE,
        lives: { gt: 0 }
      },
      data: { status: ParticipantStatus.WINNER }
    });

    // Find the top survivor for the legacy `winnerId` field (highest points, then lives)
    const topSurvivor = await tx.tournamentParticipant.findFirst({
      where: { tournamentId, status: ParticipantStatus.WINNER },
      orderBy: [{ points: "desc" }, { lives: "desc" }, { createdAt: "asc" }]
    });

    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.FINISHED,
        winnerId: topSurvivor?.userId ?? null
      }
    });
  });

  console.log(`[supervisor] Tournament ${tournamentId} FINISHED after maximum rounds.`);
  clearChat(tournamentId);
  await provisionUpcomingTournaments();
};

/** Advances the tournament to the next round. */
const advanceRound = async (tournamentId: string): Promise<void> => {
  // Eliminate anyone at 0 lives who is still marked ACTIVE
  await prisma.tournamentParticipant.updateMany({
    where: { tournamentId, status: ParticipantStatus.ACTIVE, lives: { lte: 0 } },
    data: { status: ParticipantStatus.ELIMINATED }
  });

  const survivors = await prisma.tournamentParticipant.count({
    where: {
      tournamentId,
      status: ParticipantStatus.ACTIVE,
      lives: { gt: 0 }
    }
  });

  if (survivors < 2) {
    // Edge-case: only 0 or 1 player left — finalise early
    console.log(`[supervisor] Only ${survivors} survivor(s) left — ending tournament early.`);
    await finaliseTournament(tournamentId);
    return;
  }

  console.log(`[supervisor] Advancing tournament ${tournamentId} to next round with ${survivors} survivors.`);

  // generateGladiatorPairings sets status=ACTIVE and currentRound, and now
  // also writes roundStartedAt (see pairingService changes).
  const pairings = await generateGladiatorPairings(tournamentId);
  await attachLichessGamesToMatches(pairings.matches.map((m) => m.id));

  console.log(`[supervisor] Round ${pairings.round} started for tournament ${tournamentId}.`);
};

// Per-tournament mutex: prevents evaluateRoundStatus from running the
// round-advancement logic twice simultaneously for the same tournament.
// Using a Map (not a single boolean) so tournaments are independent.
const advancingRound = new Map<string, boolean>();

/** Evaluates if the round should advance after a match completes. */
export const evaluateRoundStatus = async (tournamentId: string): Promise<void> => {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId }
  });

  if (!tournament || tournament.status !== TournamentStatus.ACTIVE) {
    return;
  }

  // Are there any matches in this round that are still in progress?
  const openMatches = await prisma.match.count({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { not: MatchStatus.COMPLETED }
    }
  });

  if (openMatches > 0) {
    // Round is still running — do nothing.
    return;
  }

  // All matches are done. Acquire the per-tournament lock before advancing.
  if (advancingRound.get(tournamentId)) {
    console.log(
      `[supervisor] Round advancement already in progress for tournament ${tournamentId}. Skipping duplicate call.`
    );
    return;
  }

  advancingRound.set(tournamentId, true);

  try {
    // Re-fetch tournament status inside the lock to avoid a TOCTOU race
    // (another caller may have already advanced the round between our count
    // query above and acquiring the lock).
    const fresh = await prisma.tournament.findUnique({ where: { id: tournamentId } });
    if (!fresh || fresh.status !== TournamentStatus.ACTIVE) {
      return;
    }
    const stillOpen = await prisma.match.count({
      where: {
        tournamentId,
        round: fresh.currentRound,
        status: { not: MatchStatus.COMPLETED }
      }
    });
    if (stillOpen > 0) {
      return;
    }

    console.log(
      `[supervisor] All matches in round ${fresh.currentRound} of tournament ${tournamentId} are COMPLETED.`
    );

    if (fresh.currentRound >= fresh.maxRounds) {
      await finaliseTournament(tournamentId);
    } else {
      await advanceRound(tournamentId);
    }
  } finally {
    advancingRound.delete(tournamentId);
  }
};

/** Cron-callable enforcer: resolves stale matches and triggers round progression. */
export const enforceRoundTimeouts = async (): Promise<void> => {
  const now = new Date();
  const cutoff = new Date(now.getTime() - ROUND_TIMEOUT_MS);

  // Find active tournaments whose round started before the cutoff
  const staleTournaments = await prisma.tournament.findMany({
    where: {
      status: TournamentStatus.ACTIVE,
      roundStartedAt: { not: null, lte: cutoff }
    }
  });

  for (const tournament of staleTournaments) {
    const staleMatches = await prisma.match.findMany({
      where: {
        tournamentId: tournament.id,
        round: tournament.currentRound,
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.PLAYING] }
      }
    });

    if (staleMatches.length === 0) {
      continue;
    }

    console.log(
      `[supervisor] Round ${tournament.currentRound} of tournament ${tournament.id} timed out. ` +
      `Force-completing ${staleMatches.length} stale match(es).`
    );

    for (const match of staleMatches) {
      try {
        // ── Step 1: Try to get a definitive result from Lichess first ────────
        // The game may have concluded during the scheduler gap.
        let lichessResult: { result: MatchResult; forfeitedPlayerId: string | null } | null = null;

        if (match.lichessGameId) {
          lichessResult = await fetchLichessGameResult(match.lichessGameId, match.whitePlayerId, match.blackPlayerId);
        }

        if (lichessResult) {
          // ── Path A: Lichess has a real result — apply it normally ──────────
          const { result, forfeitedPlayerId } = lichessResult;
          await applyNormalResult(match, result, forfeitedPlayerId, now);
          console.log(`[supervisor] Match ${match.id} — Lichess result applied at timeout: ${result}`);
        } else if (!match.lichessGameId) {
          // ── Path D: Server failure — game was never created ──────────────
          await applyServerFailureDraw(match, now);
          console.log(`[supervisor] Match ${match.id} — administrative draw (server failed to create Lichess game).`);
        } else {
          // ── Path B/C: No Lichess result — use attendance to decide ───────
          const { whiteJoined, blackJoined } = match;

          if (whiteJoined && blackJoined) {
            // Scenario C: Both clicked "Play Match" but game never started.
            // Treat as a technical draw — deduct 0.5 lives each, no points.
            await applyAttendanceDraw(match, now);
            console.log(`[supervisor] Match ${match.id} — technical draw (both joined, game aborted).`);
          } else if (whiteJoined && !blackJoined) {
            // Scenario A: White showed up, Black did not.
            // White gets walk-over win (1 pt, 0 lives lost). Black forfeits (1 life).
            await applySingleForfeit(match, match.blackPlayerId, match.whitePlayerId, now);
            console.log(`[supervisor] Match ${match.id} — forfeit: blackPlayer absent, whitePlayer wins.`);
          } else if (blackJoined && !whiteJoined) {
            // Scenario A: Black showed up, White did not.
            // Black gets walk-over win (1 pt, 0 lives lost). White forfeits (1 life).
            await applySingleForfeit(match, match.whitePlayerId, match.blackPlayerId, now);
            console.log(`[supervisor] Match ${match.id} — forfeit: whitePlayer absent, blackPlayer wins.`);
          } else {
            // Scenario B: Neither player showed up — double forfeit.
            // Both lose 1 life, no points awarded.
            await applyDoubleForfeit(match, now);
            console.log(`[supervisor] Match ${match.id} — double forfeit (neither player joined).`);
          }
        }
      } catch (err) {
        console.error(
          `[supervisor] Failed to force-complete match ${match.id}:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    // After processing all stale matches, check if the round is fully done.
    try {
      await evaluateRoundStatus(tournament.id);
    } catch (err) {
      console.error(
        `[supervisor] evaluateRoundStatus failed for tournament ${tournament.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
};
