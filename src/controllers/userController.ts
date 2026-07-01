import type { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";

// Handles fetching the public user profile, including aggregated tournament and match statistics.
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  const username = String(req.params.username);

  const user = await prisma.user.findUnique({
    where: { lichessUsername: username }
  });

  if (!user) throw new HttpError(404, `User "${username}" not found.`);

  const participations = await prisma.tournamentParticipant.findMany({
    where: { userId: user.id },
    include: { tournament: { select: { id: true, maxRounds: true, status: true } } }
  });

  const tournamentsPlayed = participations.length;
  const survived = participations.filter(
    (p) =>
      p.status === "WINNER" ||
      (p.lives > 0 && p.tournament.status === "FINISHED")
  ).length;
  const eliminated = participations.filter((p) => p.status === "ELIMINATED").length;

  const eliminatedParticipations = participations.filter(
    (p) => p.status === "ELIMINATED"
  );
  let avgEliminationRound: number | null = null;
  if (eliminatedParticipations.length > 0) {
    const elimRounds = await Promise.all(
      eliminatedParticipations.map(async (p) => {
        const lastMatch = await prisma.match.findFirst({
          where: {
            tournamentId: p.tournamentId,
            OR: [{ whitePlayerId: user.id }, { blackPlayerId: user.id }],
            status: "COMPLETED"
          },
          orderBy: { round: "desc" }
        });
        return lastMatch?.round ?? 0;
      })
    );
    const sum = elimRounds.reduce((a, b) => a + b, 0);
    avgEliminationRound = parseFloat((sum / elimRounds.length).toFixed(1));
  }

  const [whiteMatches, blackMatches] = await Promise.all([
    prisma.match.findMany({
      where: { whitePlayerId: user.id, status: "COMPLETED" },
      select: { result: true, forfeitedPlayerId: true }
    }),
    prisma.match.findMany({
      where: { blackPlayerId: user.id, status: "COMPLETED" },
      select: { result: true, forfeitedPlayerId: true }
    })
  ]);

  let wins = 0, losses = 0, draws = 0, forfeitWins = 0, forfeitLosses = 0;

  for (const m of whiteMatches) {
    if (m.result === "WHITE_WIN") wins++;
    else if (m.result === "BLACK_WIN") losses++;
    else if (m.result === "DRAW") draws++;
    else if (m.result === "FORFEIT") {
      if (m.forfeitedPlayerId !== user.id) forfeitWins++;
      else forfeitLosses++;
    }
  }
  for (const m of blackMatches) {
    if (m.result === "BLACK_WIN") wins++;
    else if (m.result === "WHITE_WIN") losses++;
    else if (m.result === "DRAW") draws++;
    else if (m.result === "FORFEIT") {
      if (m.forfeitedPlayerId !== user.id) forfeitWins++;
      else forfeitLosses++;
    }
  }

  const strikesTaken = wins + forfeitWins;
  const strikesLost = losses + forfeitLosses + draws * 0.5;

  const recentRaw = await prisma.match.findMany({
    where: {
      OR: [{ whitePlayerId: user.id }, { blackPlayerId: user.id }],
      status: "COMPLETED"
    },
    include: {
      whitePlayer: { select: { lichessUsername: true } },
      blackPlayer: { select: { lichessUsername: true } }
    },
    orderBy: { processedAt: "desc" },
    take: 10
  });

  const recentMatches = recentRaw.map((m) => {
    const isWhite = m.whitePlayerId === user.id;
    const opponent = isWhite ? m.blackPlayer.lichessUsername : m.whitePlayer.lichessUsername;

    let outcome: string;
    if (m.result === "DRAW") {
      outcome = "DRAW";
    } else if (m.result === "WHITE_WIN") {
      outcome = isWhite ? "WIN" : "LOSS";
    } else if (m.result === "BLACK_WIN") {
      outcome = isWhite ? "LOSS" : "WIN";
    } else if (m.result === "FORFEIT") {
      outcome = m.forfeitedPlayerId === user.id ? "FORFEIT LOSS" : "FORFEIT WIN";
    } else {
      outcome = "—";
    }

    return {
      date: m.processedAt ?? m.updatedAt,
      round: m.round,
      opponent,
      outcome
    };
  });

  res.json({
    user: {
      id: user.id,
      lichessUsername: user.lichessUsername,
      rating: user.rating,
      blitzRating: user.blitzRating,
      bio: user.bio ?? null,
      createdAt: user.createdAt
    },
    stats: {
      tournamentsPlayed,
      survived,
      eliminated,
      avgEliminationRound,
      wins,
      losses,
      draws,
      forfeitWins,
      forfeitLosses,
      strikesTaken,
      strikesLost
    },
    recentMatches
  });
};

// Handles authenticated requests to update the user's profile biography.
export const updateBio = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) throw new HttpError(401, "Not authenticated.");

  const bio = typeof req.body.bio === "string" ? req.body.bio.trim().slice(0, 500) : "";

  const updated = await prisma.user.update({
    where: { id: req.user.sub },
    data: { bio: bio || null },
    select: { id: true, lichessUsername: true, bio: true }
  });

  res.json({ user: updated });
};
