import type { Request, Response } from "express";
import { ParticipantStatus, TournamentStatus } from "@prisma/client";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";
import { enforceRoundTimeouts } from "../services/tournamentSupervisor";
import { attachLichessGamesToMatches } from "../services/lichessMatchService";

// Deterministic bot player roster for reproducible testing.
const BOT_PLAYERS = [
  { lichessUsername: "Bot_Magnus",   rating: 2882 },
  { lichessUsername: "Bot_Hikaru",   rating: 2736 },
  { lichessUsername: "Bot_Kasparov", rating: 2851 },
  { lichessUsername: "Bot_Anand",    rating: 2753 },
  { lichessUsername: "Bot_Tal",      rating: 2705 },
  { lichessUsername: "Bot_Fischer",  rating: 2785 },
  { lichessUsername: "Bot_Carlini",  rating: 2822 },
  { lichessUsername: "Bot_Nepo",     rating: 2758 },
] as const;

// Seeds bot players into an upcoming tournament.
export const seedTestPlayers = async (req: Request, res: Response): Promise<void> => {
  const tournamentId = String(req.params.id);

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new HttpError(404, "Tournament not found.");
  if (tournament.status !== TournamentStatus.UPCOMING) {
    throw new HttpError(409, "Can only seed test players into an UPCOMING tournament.");
  }

  const seeded: string[] = [];

  for (const bot of BOT_PLAYERS) {
    const user = await prisma.user.upsert({
      where: { lichessUsername: bot.lichessUsername },
      update: { isBot: true, rating: bot.rating },
      create: { lichessUsername: bot.lichessUsername, rating: bot.rating, isBot: true }
    });

    const existing = await prisma.tournamentParticipant.findUnique({
      where: { tournamentId_userId: { tournamentId, userId: user.id } }
    });

    if (!existing) {
      await prisma.tournamentParticipant.create({
        data: {
          tournamentId,
          userId: user.id,
          lives: 3.0,
          points: 0,
          status: ParticipantStatus.ACTIVE,
          checkedIn: true
        }
      });
      seeded.push(bot.lichessUsername);
    } else {
      await prisma.tournamentParticipant.update({
        where: { id: existing.id },
        data: { checkedIn: true }
      });
    }
  }

  res.status(201).json({
    seeded,
    message: `${seeded.length} bot player(s) added to tournament ${tournamentId}.`
  });
};

// Fast-forwards the current round by simulating bot attendance and triggering timeouts.
export const fastForwardRound = async (req: Request, res: Response): Promise<void> => {
  const tournamentId = String(req.params.id);

  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new HttpError(404, "Tournament not found.");
  if (tournament.status !== TournamentStatus.ACTIVE) {
    throw new HttpError(409, "Tournament must be ACTIVE to fast-forward a round.");
  }
  if (!tournament.roundStartedAt) {
    throw new HttpError(409, "No active round found (roundStartedAt is not set).");
  }

  const openMatches = await prisma.match.findMany({
    where: {
      tournamentId,
      round: tournament.currentRound,
      status: { in: ["SCHEDULED", "PLAYING"] }
    },
    include: { whitePlayer: true, blackPlayer: true }
  });

  for (const match of openMatches) {
    const whiteIsBot = match.whitePlayer.isBot;
    const blackIsBot = match.blackPlayer.isBot;

    if (!whiteIsBot && !blackIsBot) continue;

    const data: { whiteJoined?: boolean; blackJoined?: boolean } = {};
    if (whiteIsBot) data.whiteJoined = Math.random() < 0.5;
    if (blackIsBot) data.blackJoined = Math.random() < 0.5;

    await prisma.match.update({ where: { id: match.id }, data });
  }

  const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
  await prisma.tournament.update({
    where: { id: tournamentId },
    data: { roundStartedAt: sixteenMinutesAgo }
  });

  console.log(
    `[admin] Fast-forward: tournament ${tournamentId} round ${tournament.currentRound} ` +
    `roundStartedAt set to ${sixteenMinutesAgo.toISOString()} — triggering timeout enforcer.`
  );

  await enforceRoundTimeouts();

  res.status(200).json({
    message: `Round ${tournament.currentRound} fast-forwarded. Check server logs and the live view for results.`
  });
};

export const retryLichessGames = async (req: Request, res: Response): Promise<void> => {
  const tournamentId = String(req.params.id);
  const matches = await prisma.match.findMany({
    where: { tournamentId, status: "SCHEDULED", lichessGameId: null }
  });
  
  if (matches.length > 0) {
    await attachLichessGamesToMatches(matches.map(m => m.id));
  }
  
  res.status(200).json({ message: `Retried ${matches.length} failed Lichess match creations.` });
};
