import { MatchResult, MatchStatus, ParticipantStatus } from "@prisma/client";
import { prisma } from "../config/prisma";

export const calculateGladiatorStandings = async (tournamentId: string) => {
  const participants = await prisma.tournamentParticipant.findMany({
    where: {
      tournamentId
    },
    include: {
      user: true
    }
  });

  const matches = await prisma.match.findMany({
    where: {
      tournamentId,
      status: MatchStatus.COMPLETED
    }
  });

  const statsMap = new Map<string, { wins: number; losses: number; draws: number; livesTaken: number }>();
  for (const p of participants) {
    statsMap.set(p.userId, { wins: 0, losses: 0, draws: 0, livesTaken: 0 });
  }

  for (const match of matches) {
    const whiteStats = statsMap.get(match.whitePlayerId);
    const blackStats = statsMap.get(match.blackPlayerId);

    if (match.result === MatchResult.WHITE_WIN) {
      if (whiteStats) { whiteStats.wins += 1; whiteStats.livesTaken += 1; }
      if (blackStats) { blackStats.losses += 1; }
    } else if (match.result === MatchResult.BLACK_WIN) {
      if (blackStats) { blackStats.wins += 1; blackStats.livesTaken += 1; }
      if (whiteStats) { whiteStats.losses += 1; }
    } else if (match.result === MatchResult.DRAW) {
      if (whiteStats) { whiteStats.draws += 1; whiteStats.livesTaken += 0.5; }
      if (blackStats) { blackStats.draws += 1; blackStats.livesTaken += 0.5; }
    } else if (match.result === MatchResult.FORFEIT) {
      if (match.forfeitedPlayerId === match.blackPlayerId) {
        if (whiteStats) { whiteStats.wins += 1; whiteStats.livesTaken += 1; }
        if (blackStats) { blackStats.losses += 1; }
      } else if (match.forfeitedPlayerId === match.whitePlayerId) {
        if (blackStats) { blackStats.wins += 1; blackStats.livesTaken += 1; }
        if (whiteStats) { whiteStats.losses += 1; }
      } else {
        if (whiteStats) whiteStats.losses += 1;
        if (blackStats) blackStats.losses += 1;
      }
    }
  }

  const enhancedParticipants = participants.map(p => ({
    ...p,
    stats: statsMap.get(p.userId) ?? { wins: 0, losses: 0, draws: 0, livesTaken: 0 }
  }));

  return enhancedParticipants.sort((a, b) => {
    if (a.status !== b.status) {
      const statusOrder: Record<ParticipantStatus, number> = { WINNER: 0, ACTIVE: 1, ELIMINATED: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    }

    if (a.lives !== b.lives) {
      return b.lives - a.lives;
    }

    if (a.points !== b.points) {
      return b.points - a.points;
    }

    const ratingA = a.user.blitzRating ?? a.user.rating ?? 0;
    const ratingB = b.user.blitzRating ?? b.user.rating ?? 0;
    if (ratingA !== ratingB) {
      return ratingB - ratingA;
    }

    return a.user.lichessUsername.localeCompare(b.user.lichessUsername);
  });
};
