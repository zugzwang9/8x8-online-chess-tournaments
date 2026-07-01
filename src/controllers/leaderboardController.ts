import type { Request, Response } from "express";
import { prisma } from "../config/prisma";

export const getGlobalLeaderboard = async (req: Request, res: Response): Promise<void> => {
  const leaderboardRaw = await prisma.$queryRaw<Array<{
    id: string;
    lichessUsername: string;
    rating: number;
    blitzRating: number | null;
    totalWins: number | bigint;
    totalLosses: number | bigint;
    totalDraws: number | bigint;
  }>>`
    SELECT 
      u."id",
      u."lichessUsername",
      u."rating",
      u."blitzRating",
      CAST(
        SUM(CASE WHEN m."result" = 'WHITE_WIN' AND m."whitePlayerId" = u."id" THEN 1 ELSE 0 END) +
        SUM(CASE WHEN m."result" = 'BLACK_WIN' AND m."blackPlayerId" = u."id" THEN 1 ELSE 0 END) +
        SUM(CASE WHEN m."result" = 'FORFEIT' AND m."forfeitedPlayerId" != u."id" THEN 1 ELSE 0 END)
      AS INTEGER) as "totalWins",
      
      CAST(
        SUM(CASE WHEN m."result" = 'BLACK_WIN' AND m."whitePlayerId" = u."id" THEN 1 ELSE 0 END) +
        SUM(CASE WHEN m."result" = 'WHITE_WIN' AND m."blackPlayerId" = u."id" THEN 1 ELSE 0 END) +
        SUM(CASE WHEN m."result" = 'FORFEIT' AND m."forfeitedPlayerId" = u."id" THEN 1 ELSE 0 END)
      AS INTEGER) as "totalLosses",

      CAST(SUM(CASE WHEN m."result" = 'DRAW' THEN 1 ELSE 0 END) AS INTEGER) as "totalDraws"

    FROM "User" u
    JOIN "Match" m ON m."whitePlayerId" = u."id" OR m."blackPlayerId" = u."id"
    WHERE m."status" = 'COMPLETED'
      AND u."isBot" = false
    GROUP BY u."id", u."lichessUsername", u."rating", u."blitzRating"
    ORDER BY "totalWins" DESC, "totalLosses" ASC
  `;

  const leaderboard = leaderboardRaw.map((row, index) => {
    const wins = Number(row.totalWins) || 0;
    const losses = Number(row.totalLosses) || 0;
    const draws = Number(row.totalDraws) || 0;
    const totalGames = wins + losses + draws;
    const winPercentage = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
    
    return {
      rank: index + 1,
      user: {
        id: row.id,
        lichessUsername: row.lichessUsername,
        rating: row.rating,
        blitzRating: row.blitzRating
      },
      stats: {
        wins,
        losses,
        draws,
        totalGames,
        winPercentage
      }
    };
  });

  res.json({ leaderboard });
};
