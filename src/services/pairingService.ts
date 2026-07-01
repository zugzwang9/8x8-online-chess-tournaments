import { MatchResult, MatchStatus, ParticipantStatus, TournamentStatus, type TournamentParticipant, type User } from "@prisma/client";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";

type ParticipantWithUser = TournamentParticipant & {
  user: User;
};

type Pairing = {
  whitePlayerId: string;
  blackPlayerId: string;
};

const participantLabel = (participant: ParticipantWithUser): string =>
  `${participant.user.lichessUsername}(${participant.lives}L/${participant.points}p)`;

const buildPlayedMap = async (tournamentId: string): Promise<Set<string>> => {
  const previousMatches = await prisma.match.findMany({
    where: {
      tournamentId
    },
    select: {
      whitePlayerId: true,
      blackPlayerId: true
    }
  });

  return new Set(
    previousMatches.map((match) =>
      [match.whitePlayerId, match.blackPlayerId].sort().join(":")
    )
  );
};

const havePlayed = (playedPairs: Set<string>, a: string, b: string): boolean =>
  playedPairs.has([a, b].sort().join(":"));

const findPairings = (participants: ParticipantWithUser[], playedPairs: Set<string>, allowRepeatedOpponents: boolean): Pairing[] | null => {
  if (participants.length === 0) {
    return [];
  }

  const [first, ...rest] = participants;
  const candidates = rest
    .map((participant, index) => ({ participant, index }))
    .filter(({ participant }) => allowRepeatedOpponents || !havePlayed(playedPairs, first.userId, participant.userId))
    .sort((a, b) => {
      const lifeDiff = Math.abs(first.lives - a.participant.lives) - Math.abs(first.lives - b.participant.lives);
      if (lifeDiff !== 0) {
        return lifeDiff;
      }

      const pointsDiff = Math.abs(first.points - a.participant.points) - Math.abs(first.points - b.participant.points);
      if (pointsDiff !== 0) {
        return pointsDiff;
      }

      return a.participant.user.lichessUsername.localeCompare(b.participant.user.lichessUsername);
    });

  for (const { participant, index } of candidates) {
    const remaining = rest.filter((_candidate, restIndex) => restIndex !== index);
    const tailPairings = findPairings(remaining, playedPairs, allowRepeatedOpponents);

    if (tailPairings) {
      return [
        {
          whitePlayerId: first.userId,
          blackPlayerId: participant.userId
        },
        ...tailPairings
      ];
    }
  }

  return null;
};

const pickByeParticipant = (participants: ParticipantWithUser[]): ParticipantWithUser => {
  const sortByeCandidates = (candidates: ParticipantWithUser[]): ParticipantWithUser[] =>
    candidates.sort((a, b) => {
      if (a.points !== b.points) {
        return a.points - b.points;
      }

      if (a.lives !== b.lives) {
        return a.lives - b.lives;
      }

      return a.createdAt.getTime() - b.createdAt.getTime();
    });

  const firstByeCandidates = sortByeCandidates(participants.filter((participant) => !participant.hasReceivedBye));

  if (firstByeCandidates[0]) {
    return firstByeCandidates[0];
  }

  console.warn("[pairing] Every active participant has already received a BYE. Falling back to repeated BYE.");
  return sortByeCandidates([...participants])[0];
};

export const generateGladiatorPairings = async (tournamentId: string) => {
  const tournament = await prisma.tournament.findUnique({
    where: {
      id: tournamentId
    }
  });

  if (!tournament) {
    throw new HttpError(404, "Tournament not found.");
  }

  if (tournament.status === TournamentStatus.FINISHED) {
    throw new HttpError(409, "Tournament is already finished.");
  }

  const nextRound = tournament.currentRound + 1;
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
      { lives: "desc" },
      { points: "desc" },
      { createdAt: "asc" }
    ]
  });

  if (activeParticipants.length < 2) {
    throw new HttpError(409, "At least two active participants are required to generate pairings.");
  }

  console.log(`[pairing] Tournament ${tournamentId}, round ${nextRound}`);
  for (const lives of [3, 2, 1]) {
    const group = activeParticipants.filter((participant) => participant.lives === lives);
    console.log(`[pairing] ${lives} lives: ${group.map(participantLabel).join(", ") || "none"}`);
  }

  const existingRoundMatches = await prisma.match.count({
    where: {
      tournamentId,
      round: nextRound
    }
  });

  if (existingRoundMatches > 0) {
    throw new HttpError(409, `Round ${nextRound} has already been generated.`);
  }

  const playedPairs = await buildPlayedMap(tournamentId);
  let byeParticipant: ParticipantWithUser | null = null;
  let pairingPool = [...activeParticipants];

  if (pairingPool.length % 2 === 1) {
    byeParticipant = pickByeParticipant(pairingPool);
    pairingPool = pairingPool.filter((participant) => participant.id !== byeParticipant?.id);
    console.log(`[pairing] BYE: ${participantLabel(byeParticipant)}`);
  }

  let pairings = findPairings(pairingPool, playedPairs, false);

  if (!pairings) {
    console.warn("[pairing] No legal no-rematch pairing found. Falling back to repeated opponents.");
    pairings = findPairings(pairingPool, playedPairs, true);
  }

  if (!pairings) {
    throw new HttpError(409, "Could not generate pairings for the active field.");
  }

  pairings.forEach((pairing, index) => {
    const white = activeParticipants.find((participant) => participant.userId === pairing.whitePlayerId);
    const black = activeParticipants.find((participant) => participant.userId === pairing.blackPlayerId);
    console.log(`[pairing] Board ${index + 1}: ${white ? participantLabel(white) : pairing.whitePlayerId} vs ${black ? participantLabel(black) : pairing.blackPlayerId}`);
  });

  const created = await prisma.$transaction(async (tx) => {
    if (byeParticipant) {
      await tx.tournamentParticipant.update({
        where: {
          id: byeParticipant.id
        },
        data: {
          points: {
            increment: 1
          },
          hasReceivedBye: true
        }
      });

      if (!byeParticipant.hasReceivedBye) {
        await tx.tournamentBye.create({
          data: {
            tournamentId,
            userId: byeParticipant.userId,
            round: nextRound
          }
        });
      }
    }

    const matches = await Promise.all(
      pairings.map((pairing) =>
        tx.match.create({
          data: {
            tournamentId,
            round: nextRound,
            whitePlayerId: pairing.whitePlayerId,
            blackPlayerId: pairing.blackPlayerId,
            result: MatchResult.PENDING,
            status: MatchStatus.SCHEDULED
          }
        })
      )
    );

    await tx.tournament.update({
      where: {
        id: tournamentId
      },
      data: {
        status: TournamentStatus.ACTIVE,
        currentRound: nextRound,
        roundStartedAt: new Date()
      }
    });

    return matches;
  });

  return {
    round: nextRound,
    matches: created,
    bye: byeParticipant
  };
};
