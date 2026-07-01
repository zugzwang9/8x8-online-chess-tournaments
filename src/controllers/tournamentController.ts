import { MatchResult, MatchStatus, ParticipantStatus, Prisma, TournamentStatus, TournamentType } from "@prisma/client";
import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { generateGladiatorPairings } from "../services/pairingService";
import { calculateGladiatorStandings } from "../services/standingsService";
import { evaluateRoundStatus } from "../services/tournamentSupervisor";
import { assertCanCreateLichessGames, attachLichessGamesToMatches } from "../services/lichessMatchService";
import { HttpError } from "../utils/httpError";

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) {
    throw new HttpError(401, "Not authenticated.");
  }

  return req.user.sub;
};

const getTournamentId = (req: Request): string => {
  const { id } = req.params;

  if (typeof id !== "string") {
    throw new HttpError(400, "Tournament id is required.");
  }

  return id;
};

const normalizeSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const findTournamentByIdOrSlug = async (
  identifier: string,
  include?: Prisma.TournamentInclude
) => {
  const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);

  if (isValidUUID) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: identifier },
      include
    });
    if (tournament) return tournament;
  }

  const normalizedIdentifier = normalizeSlug(identifier);
  
  // Try querying by slug first (for newly created tournaments)
  let tournamentBySlug = await prisma.tournament.findUnique({
    where: { slug: normalizedIdentifier },
    include
  });

  if (tournamentBySlug) return tournamentBySlug;

  // Fallback for older tournaments without a slug
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true }
  });
  const match = tournaments.find((item) => normalizeSlug(item.name) === normalizedIdentifier);

  if (!match) {
    return null;
  }

  return prisma.tournament.findUnique({
    where: {
      id: match.id
    },
    include
  });
};

const parseTournamentType = (type: unknown): TournamentType => {
  if (typeof type !== "string" || !(type in TournamentType)) {
    throw new HttpError(400, "Tournament type must be one of BULLET, BLITZ or RAPID.");
  }

  return TournamentType[type as keyof typeof TournamentType];
};

export const checkInTournament = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const tournamentId = getTournamentId(req);

  const tournament = await findTournamentByIdOrSlug(tournamentId);
  if (!tournament) throw new HttpError(404, "Tournament not found.");

  if (tournament.status !== TournamentStatus.UPCOMING) {
    throw new HttpError(409, "Tournament is not in registration phase.");
  }

  if (tournament.registrationClosesAt) {
    const msTillStart = tournament.registrationClosesAt.getTime() - Date.now();
    if (msTillStart > 60 * 60 * 1000 || msTillStart < 0) {
      throw new HttpError(409, "Check-in is not currently open.");
    }
  }

  const participant = await prisma.tournamentParticipant.findUnique({
    where: { tournamentId_userId: { tournamentId: tournament.id, userId } }
  });
  if (!participant) throw new HttpError(400, "User is not registered for this tournament.");
  await prisma.tournamentParticipant.update({
    where: { id: participant.id },
    data: { checkedIn: true }
  });
  const standings = await calculateGladiatorStandings(tournamentId);
  res.json({ success: true, standings });
};

export const createTournament = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUserId(req);

  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    throw new HttpError(400, "Tournament name is required.");
  }

  // allow optional registrationClosesAt in request body, else default to next Sunday 19:00
  let registrationClosesAt: Date | null = null;
  if (req.body.registrationClosesAt) {
    const parsed = new Date(req.body.registrationClosesAt);
    if (!isNaN(parsed.getTime())) {
      registrationClosesAt = parsed;
    }
  }

  if (!registrationClosesAt) {
    // Use UTC arithmetic to match tournamentProvisionerService (17:00 UTC = tournament start time).
    // Avoid setHours() which uses the server's local clock and would produce the wrong timestamp
    // on a host running in any timezone other than UTC+0.
    const now = new Date();
    const day = now.getUTCDay(); // 0 = Sunday
    const daysUntilSunday = (7 - day) % 7 || 7;
    const nextSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    nextSunday.setUTCDate(nextSunday.getUTCDate() + daysUntilSunday);
    nextSunday.setUTCHours(17, 0, 0, 0);
    if (nextSunday.getTime() <= Date.now()) {
      nextSunday.setUTCDate(nextSunday.getUTCDate() + 7);
    }
    registrationClosesAt = nextSunday;
  }

  const tournament = await prisma.tournament.create({
    data: {
      name,
      slug: normalizeSlug(name),
      type: parseTournamentType(req.body.type),
      status: TournamentStatus.UPCOMING,
      currentRound: 0,
      registrationClosesAt
    }
  });

  res.status(201).json({ tournament });
};

export const listTournaments = async (_req: Request, res: Response): Promise<void> => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: {
      createdAt: "desc"
    },
    include: {
      winner: true,
      _count: {
        select: {
          participants: true,
          matches: true
        }
      }
    }
  });

  res.json({ tournaments });
};

export const getTournamentLive = async (req: Request, res: Response): Promise<void> => {
  const tournamentId = getTournamentId(req);
  const tournament = await findTournamentByIdOrSlug(tournamentId, {
    winner: true,
    byes: {
      include: {
        user: true
      },
      orderBy: {
        round: "asc"
      }
    }
  });

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  const resolvedTournamentId = tournament.id;
  const matches = await prisma.match.findMany({
    where: {
      tournamentId: resolvedTournamentId
    },
    include: {
      whitePlayer: true,
      blackPlayer: true
    },
    orderBy: [
      { round: "asc" },
      { createdAt: "asc" }
    ]
  });

  res.json({
    tournament,
    matches,
    standings: await calculateGladiatorStandings(resolvedTournamentId)
  });
};

export const joinTournament = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const tournamentId = getTournamentId(req);

  const tournament = await findTournamentByIdOrSlug(tournamentId);

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  if (tournament.status === TournamentStatus.FINISHED) {
    throw new HttpError(409, "Cannot join a finished tournament.");
  }

  if (tournament.status === TournamentStatus.ACTIVE) {
    throw new HttpError(409, "Cannot join a tournament that is already in progress.");
  }

  const participant = await prisma.$transaction(async (tx) => {
    const existingParticipant = await tx.tournamentParticipant.findFirst({
      where: {
        tournamentId: tournament.id,
        userId
      }
    });

    if (existingParticipant) {
      throw new HttpError(400, "User is already registered for this tournament.");
    }

    return tx.tournamentParticipant.create({
      data: {
        tournamentId: tournament.id,
        userId,
        lives: 3,
        points: 0,
        status: ParticipantStatus.ACTIVE
      }
    });
  });

  const standings = await calculateGladiatorStandings(tournament.id);

  res.status(200).json({ participant, standings });
};

export const leaveTournament = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const tournamentId = getTournamentId(req);

  const tournament = await findTournamentByIdOrSlug(tournamentId);

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  if (tournament.status === TournamentStatus.FINISHED) {
    throw new HttpError(409, "Cannot leave a tournament that has already finished.");
  }

  const existingParticipant = await prisma.tournamentParticipant.findFirst({
    where: {
      tournamentId: tournament.id,
      userId
    }
  });

  if (!existingParticipant) {
    res.status(400).json({ error: "User is not registered for this tournament." });
    return;
  }

  if (tournament.status === TournamentStatus.UPCOMING) {
    await prisma.tournamentParticipant.delete({
      where: {
        id: existingParticipant.id
      }
    });
  } else {
    // Guard against double-leave: two rapid clicks would both see the participant as ACTIVE,
    // causing the forfeit and round-evaluation logic to fire twice on the same match.
    if (existingParticipant.status === ParticipantStatus.ELIMINATED) {
      throw new HttpError(409, "You have already left this tournament.");
    }

    await prisma.tournamentParticipant.update({
      where: {
        id: existingParticipant.id
      },
      data: {
        status: ParticipantStatus.ELIMINATED,
        lives: 0
      }
    });

    const activeMatch = await prisma.match.findFirst({
      where: {
        tournamentId: tournament.id,
        round: tournament.currentRound,
        status: { in: [MatchStatus.SCHEDULED, MatchStatus.PLAYING] },
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }]
      }
    });

    if (activeMatch) {
      await prisma.$transaction(async (tx) => {
        await tx.match.update({
          where: { id: activeMatch.id },
          data: {
            status: MatchStatus.COMPLETED,
            result: MatchResult.FORFEIT,
            forfeitedPlayerId: userId,
            processedAt: new Date()
          }
        });

        const winnerId = activeMatch.whitePlayerId === userId ? activeMatch.blackPlayerId : activeMatch.whitePlayerId;
        await tx.tournamentParticipant.update({
          where: { tournamentId_userId: { tournamentId: tournament.id, userId: winnerId } },
          data: { points: { increment: 1 }, consecutiveForfeits: 0 }
        });
      });

      await evaluateRoundStatus(tournament.id);
    }
  }

  const standings = await calculateGladiatorStandings(tournament.id);

  res.status(200).json({ success: true, standings });
};

export const startTournament = async (req: Request, res: Response): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  assertCanCreateLichessGames();
  const tournamentId = getTournamentId(req);

  const tournament = await prisma.tournament.findUnique({
    where: {
      id: tournamentId
    }
  });

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  if (tournament.status !== TournamentStatus.UPCOMING) {
    throw new HttpError(409, "Tournament has already started or finished.");
  }

  await prisma.$transaction(async (tx) => {
    // Auto check-in the admin who is starting the tournament
    await tx.tournamentParticipant.updateMany({
      where: { tournamentId, userId },
      data: { checkedIn: true }
    });

    // Purge all no-shows before starting
    await tx.tournamentParticipant.deleteMany({
      where: { tournamentId, checkedIn: false }
    });
    const count = await tx.tournamentParticipant.count({
      where: { tournamentId }
    });
    if (count < 2) {
      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: "FINISHED" }
      });
      throw new HttpError(400, "Not enough checked-in participants. Tournament cancelled.");
    }
  });

  const pairings = await generateGladiatorPairings(tournamentId);

  await attachLichessGamesToMatches(pairings.matches.map((match) => match.id));
  res.status(201).json(pairings);
};

export const stopTournament = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUserId(req);

  const tournamentId = getTournamentId(req);
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId }
  });

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  // Allow reset from ACTIVE (mid-tournament) or FINISHED (post-11-rounds).
  // Refuse on UPCOMING — there's nothing to reset yet.
  if (
    tournament.status !== TournamentStatus.ACTIVE &&
    tournament.status !== TournamentStatus.FINISHED
  ) {
    throw new HttpError(409, "Tournament has not started yet — nothing to reset.");
  }

  await prisma.$transaction(async (tx) => {
    // Reset the tournament row in a single update
    await tx.tournament.update({
      where: { id: tournamentId },
      data: {
        status: TournamentStatus.UPCOMING,
        currentRound: 0,
        winnerId: null,
        roundStartedAt: null   // prevents timeout enforcer from firing after reset
      }
    });

    // Delete all generated match and bye records
    await tx.match.deleteMany({ where: { tournamentId } });
    await tx.tournamentBye.deleteMany({ where: { tournamentId } });

    // Restore every participant to their initial state (including WINNER → ACTIVE)
    await tx.tournamentParticipant.updateMany({
      where: { tournamentId },
      data: {
        lives: 3.0,
        points: 0,
        status: ParticipantStatus.ACTIVE,
        hasReceivedBye: false,
        checkedIn: false
      }
    });
  });

  res.status(200).json({ success: true });
};


const updateParticipantAfterLoss = async (tx: Prisma.TransactionClient, tournamentId: string, userId: string): Promise<void> => {
  const participant = await tx.tournamentParticipant.findUnique({
    where: {
      tournamentId_userId: {
        tournamentId,
        userId
      }
    }
  });

  if (!participant) {
    throw new HttpError(500, "Match references a player who is not a tournament participant.");
  }

  const lives = Math.max(0, participant.lives - 1);

  await tx.tournamentParticipant.update({
    where: {
      id: participant.id
    },
    data: {
      lives,
      status: lives === 0 ? ParticipantStatus.ELIMINATED : ParticipantStatus.ACTIVE
    }
  });
};

/**
 * @deprecated The tournament supervisor (tournamentSupervisor.ts) now handles
 * round advancement automatically after every match completes and after the
 * 15-minute timeout. This endpoint remains as an admin escape-hatch only.
 */
export const advanceToNextRound = async (req: Request, res: Response): Promise<void> => {
  getAuthenticatedUserId(req);

  const tournamentId = getTournamentId(req);
  const tournament = await prisma.tournament.findUnique({
    where: {
      id: tournamentId
    }
  });

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  if (tournament.status !== TournamentStatus.ACTIVE) {
    throw new HttpError(409, "Only active tournaments can advance rounds.");
  }

  const unresolvedMatches = await prisma.match.count({
    where: {
      tournamentId,
      round: tournament.currentRound,
      OR: [
        { status: { not: MatchStatus.COMPLETED } },
        { result: MatchResult.PENDING }
      ]
    }
  });

  if (unresolvedMatches > 0) {
    throw new HttpError(409, "All matches in the current round must be completed before advancing.");
  }

  await prisma.$transaction(async (tx) => {
    const matchesToProcess = await tx.match.findMany({
      where: {
        tournamentId,
        round: tournament.currentRound,
        processedAt: null
      }
    });

    for (const match of matchesToProcess) {
      // Points and lives are now updated immediately by the game end listener
      await tx.match.update({
        where: {
          id: match.id
        },
        data: {
          processedAt: new Date()
        }
      });
    }
  });

  const activeParticipants = await prisma.tournamentParticipant.findMany({
    where: {
      tournamentId,
      status: ParticipantStatus.ACTIVE,
      lives: {
        gt: 0
      }
    },
    include: {
      user: true
    },
    orderBy: [
      { points: "desc" },
      { lives: "desc" },
      { createdAt: "asc" }
    ]
  });

  if (activeParticipants.length <= 1) {
    const winner = activeParticipants[0] ?? (await calculateGladiatorStandings(tournamentId))[0];

    await prisma.tournament.update({
      where: {
        id: tournamentId
      },
      data: {
        status: TournamentStatus.FINISHED,
        winnerId: winner?.userId
      }
    });

    res.json({
      finished: true,
      winner,
      standings: await calculateGladiatorStandings(tournamentId)
    });
    return;
  }

  try {
    const pairings = await generateGladiatorPairings(tournamentId);
    await attachLichessGamesToMatches(pairings.matches.map((match) => match.id));
    res.status(201).json({
      finished: false,
      ...pairings
    });
  } catch (error) {
    if (!(error instanceof HttpError) || error.statusCode !== 409) {
      throw error;
    }

    const standings = await calculateGladiatorStandings(tournamentId);
    const winner = standings[0];

    await prisma.tournament.update({
      where: {
        id: tournamentId
      },
      data: {
        status: TournamentStatus.FINISHED,
        winnerId: winner?.userId
      }
    });

    res.json({
      finished: true,
      reason: error.message,
      winner,
      standings
    });
  }
};

export const getTournamentStandings = async (req: Request, res: Response): Promise<void> => {
  const tournamentId = getTournamentId(req);
  const tournament = await findTournamentByIdOrSlug(tournamentId);

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  const standings = await calculateGladiatorStandings(tournament.id);
  res.json({ standings });
};

export const getUpcomingTournament = async (_req: Request, res: Response): Promise<void> => {
  const tournament = await prisma.tournament.findFirst({
    where: {
      status: TournamentStatus.UPCOMING
    },
    orderBy: {
      createdAt: "asc"
    },
    include: {
      winner: true,
      _count: {
        select: {
          participants: true,
          matches: true
        }
      }
    }
  });

  if (!tournament) {
    res.json({ tournament: null });
    return;
  }

  res.json({ tournament });
};
