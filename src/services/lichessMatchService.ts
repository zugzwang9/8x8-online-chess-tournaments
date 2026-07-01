import axios from "axios";
import { MatchResult, MatchStatus, ParticipantStatus, TournamentType } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { HttpError } from "../utils/httpError";

type GameType = "BULLET" | "BLITZ" | "RAPID";

// Response shape for /api/challenge/open (open challenges have a flat structure,
// unlike directed challenges which nest under a `challenge` key).
interface LichessOpenChallengeResponse {
  id: string;
  url: string;
  urlWhite?: string;
  urlBlack?: string;
}

interface LichessGameExportResponse {
  id: string;
  status: string;
  winner?: "white" | "black";
  moves?: string;
  players?: {
    white?: {
      user?: { id?: string; name?: string };
      userId?: string;
    };
    black?: {
      user?: { id?: string; name?: string };
      userId?: string;
    };
  };
}

const finishedStatuses = new Set([
  "mate",
  "resign",
  "stalemate",
  "timeout",
  "draw",
  "outoftime",
  "cheat",
  "aborted",
  "noStart",
  "unknownFinish",
  "variantEnd"
]);

// 5+0 Blitz per tournament rules
const timeControls: Record<GameType, { limit: number; increment: number }> = {
  BULLET: { limit: 60, increment: 0 },
  BLITZ:  { limit: 300, increment: 0 },
  RAPID:  { limit: 600, increment: 0 }
};

const lichess = axios.create({
  baseURL: "https://lichess.org",
  timeout: 15000,
  headers: { Accept: "application/json" }
});

const authHeaders = () =>
  env.lichessApiToken
    ? { Authorization: `Bearer ${env.lichessApiToken}` }
    : {};

// ---------------------------------------------------------------------------
// Game creation
// ---------------------------------------------------------------------------

const createLichessGame = async (
  whiteUsername: string,
  blackUsername: string,
  gameType: GameType,
  whiteAccessToken?: string | null
): Promise<{
  gameId: string;
  challengeUrl: string;
  whiteUrl: string | null;
  blackUrl: string | null;
}> => {
  const clock = timeControls[gameType];
  const body = new URLSearchParams({
    rated: String(env.lichessRatedChallenges),
    variant: "standard",
    name: `Gladiator: ${whiteUsername} vs ${blackUsername}`,
    "clock.limit": String(clock.limit),
    "clock.increment": String(clock.increment),
    // Assign the challenge to both players so each gets a unique join URL.
    // Requires a Lichess API token with challenge:write scope.
    users: `${whiteUsername},${blackUsername}`
  });

  console.log(
    `[lichess] Creating ${gameType} challenge: ${whiteUsername} (white) vs ${blackUsername} (black), rated=${env.lichessRatedChallenges}`
  );

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded"
  };
  
  if (whiteAccessToken) {
    requestHeaders["Authorization"] = `Bearer ${whiteAccessToken}`;
  } else if (env.lichessApiToken) {
    requestHeaders["Authorization"] = `Bearer ${env.lichessApiToken}`;
  }
  const response = await lichess.post<LichessOpenChallengeResponse>("/api/challenge/open", body, {
    headers: requestHeaders
  });

  const data = response.data;
  if (!data?.id) {
    const lichessError = (data as any)?.error ?? JSON.stringify(data);
    console.error("[lichess] Unexpected response body:", data);
    throw new Error(`Lichess returned an unexpected response: ${lichessError}`);
  }

  return {
    gameId: data.id,
    challengeUrl: data.url,
    whiteUrl: data.urlWhite ?? null,
    blackUrl: data.urlBlack ?? null
  };
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const attachLichessGamesToMatches = async (matchIds: string[]): Promise<void> => {
  const matches = await prisma.match.findMany({
    where: { id: { in: matchIds } },
    include: { tournament: true, whitePlayer: true, blackPlayer: true }
  });

  for (const match of matches) {
    if (match.lichessGameId) continue;

    try {
      const game = await createLichessGame(
        match.whitePlayer.lichessUsername,
        match.blackPlayer.lichessUsername,
        match.tournament.type as TournamentType,
        match.whitePlayer.lichessAccessToken
      );

      await prisma.match.update({
        where: { id: match.id },
        data: {
          lichessGameId: game.gameId,
          lichessChallengeUrl: game.challengeUrl,
          lichessWhiteUrl: game.whiteUrl,
          lichessBlackUrl: game.blackUrl,
          status: MatchStatus.PLAYING
        }
      });
      
      // Throttle to respect Lichess API rate limits
      await delay(300);
    } catch (error: any) {
      console.error(`[lichess] Failed to create game for Match ${match.id}:`, error?.response?.data || error.message);
      // DO NOT THROW. Allow the successfully created matches to save. 
      // The failed match stays "SCHEDULED" and can be retried by the admin.
    }
  }
};

// ---------------------------------------------------------------------------
// Game export / result fetching
// ---------------------------------------------------------------------------

const fetchLichessGame = async (gameId: string): Promise<LichessGameExportResponse | null> => {
  try {
    const response = await lichess.get<LichessGameExportResponse>(`/game/export/${gameId}`, {
      params: { moves: true, tags: false, clocks: false, evals: false, opening: false },
      headers: { ...authHeaders(), Accept: "application/json" }
    });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      console.warn(`[lichess] Game ${gameId} is not exportable yet.`);
      return null;
    }
    throw error;
  }
};

const resultFromGame = (game: LichessGameExportResponse): MatchResult => {
  if (game.status === "draw" || game.status === "stalemate" || !game.winner) {
    return MatchResult.DRAW;
  }
  return game.winner === "white" ? MatchResult.WHITE_WIN : MatchResult.BLACK_WIN;
};

const inferForfeitedUserId = (
  game: LichessGameExportResponse,
  whitePlayerId: string,
  blackPlayerId: string
): string | null => {
  if (game.status === "cheat") {
    if (!game.winner) return null;
    return game.winner === "white" ? blackPlayerId : whitePlayerId;
  }

  if (game.status === "noStart" || game.status === "aborted") {
    const moves = game.moves?.trim() || "";
    if (moves === "") {
      return whitePlayerId; // White never moved — forfeit on white
    }
    const moveCount = moves.split(/\s+/).length;
    if (moveCount === 1) {
      return blackPlayerId; // White moved, Black never responded — forfeit on black
    }
    // Both players made at least one move — this is a technical abort, not a
    // no-show by either player. No individual forfeit should be assigned.
    return null;
  }

  return null;
};

/**
 * Exported for the tournament supervisor: fetches a Lichess game and returns a
 * normalised result struct, or null if the game is not yet finished.
 */
export const fetchLichessGameResult = async (
  gameId: string,
  whitePlayerId: string,
  blackPlayerId: string
): Promise<{ result: MatchResult; forfeitedPlayerId: string | null } | null> => {
  const game = await fetchLichessGame(gameId);
  if (!game || !finishedStatuses.has(game.status)) {
    return null;
  }
  
  const forfeitedPlayerId = inferForfeitedUserId(game, whitePlayerId, blackPlayerId);
  const result = forfeitedPlayerId ? MatchResult.FORFEIT : resultFromGame(game);
  return { result, forfeitedPlayerId };
};

// ---------------------------------------------------------------------------
// Active game poller (called by scheduler every 30s)
// ---------------------------------------------------------------------------

export const checkActiveGames = async (): Promise<{
  checked: number;
  completed: number;
}> => {
  const activeMatches = await prisma.match.findMany({
    where: {
      status: MatchStatus.PLAYING,
      lichessGameId: { not: null }
    }
  });

  let completed = 0;

  for (const match of activeMatches) {
    if (!match.lichessGameId) continue;

    const game = await fetchLichessGame(match.lichessGameId);
    if (!game || !finishedStatuses.has(game.status)) continue;

    const forfeitedPlayerId = inferForfeitedUserId(game, match.whitePlayerId, match.blackPlayerId);
    const result = forfeitedPlayerId ? MatchResult.FORFEIT : resultFromGame(game);

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: match.id },
        data: { result, status: MatchStatus.COMPLETED, forfeitedPlayerId, processedAt: new Date() }
      });

      if (forfeitedPlayerId) {
        const winnerId =
          forfeitedPlayerId === match.whitePlayerId ? match.blackPlayerId : match.whitePlayerId;

        // Winner: award point and clear their consecutive-forfeit streak.
        await tx.tournamentParticipant.update({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: winnerId } },
          data: { points: { increment: 1 }, consecutiveForfeits: 0 }
        });

        // Forfeiter: deduct 1 life and increment their consecutive-forfeit counter.
        // Mirrors adjustParticipant() in tournamentSupervisor — elimination only
        // when lives reach 0 OR the player has 2+ consecutive forfeits.
        const forfeiter = await tx.tournamentParticipant.findUnique({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: forfeitedPlayerId } }
        });
        if (forfeiter) {
          const lives = Math.max(0, forfeiter.lives - 1);
          const consecutiveForfeits = forfeiter.consecutiveForfeits + 1;
          const isEliminated = lives === 0 || consecutiveForfeits >= 2;
          await tx.tournamentParticipant.update({
            where: { id: forfeiter.id },
            data: {
              lives,
              consecutiveForfeits,
              status: isEliminated ? ParticipantStatus.ELIMINATED : ParticipantStatus.ACTIVE
            }
          });
        }
      } else if (result === MatchResult.WHITE_WIN) {
        await tx.tournamentParticipant.update({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: match.whitePlayerId } },
          data: { points: { increment: 1 }, consecutiveForfeits: 0 }
        });
        const loser = await tx.tournamentParticipant.findUnique({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: match.blackPlayerId } }
        });
        if (loser) {
          const lives = Math.max(0, loser.lives - 1);
          await tx.tournamentParticipant.update({
            where: { id: loser.id },
            data: { lives, consecutiveForfeits: 0, status: lives === 0 ? ParticipantStatus.ELIMINATED : ParticipantStatus.ACTIVE }
          });
        }
      } else if (result === MatchResult.BLACK_WIN) {
        await tx.tournamentParticipant.update({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: match.blackPlayerId } },
          data: { points: { increment: 1 }, consecutiveForfeits: 0 }
        });
        const loser = await tx.tournamentParticipant.findUnique({
          where: { tournamentId_userId: { tournamentId: match.tournamentId, userId: match.whitePlayerId } }
        });
        if (loser) {
          const lives = Math.max(0, loser.lives - 1);
          await tx.tournamentParticipant.update({
            where: { id: loser.id },
            data: { lives, consecutiveForfeits: 0, status: lives === 0 ? ParticipantStatus.ELIMINATED : ParticipantStatus.ACTIVE }
          });
        }
      } else if (result === MatchResult.DRAW) {
        for (const userId of [match.whitePlayerId, match.blackPlayerId]) {
          const p = await tx.tournamentParticipant.findUnique({
            where: { tournamentId_userId: { tournamentId: match.tournamentId, userId } }
          });
          if (p) {
            const lives = Math.max(0, p.lives - 0.5);
            await tx.tournamentParticipant.update({
              where: { id: p.id },
              data: { 
                lives, 
                consecutiveForfeits: 0,
                points: { increment: 0.5 },
                status: lives === 0 ? ParticipantStatus.ELIMINATED : ParticipantStatus.ACTIVE 
              }
            });
          }
        }
      }
    });

    completed += 1;
    console.log(`[lichess] Completed game ${match.lichessGameId}: ${game.status} -> ${result}`);

    // Trigger automatic round advancement after every match completion.
    // Lazy import to avoid circular dependency at module load time.
    try {
      const { evaluateRoundStatus } = await import("./tournamentSupervisor");
      await evaluateRoundStatus(match.tournamentId);
    } catch (supervisorErr) {
      console.error(
        "[lichess] evaluateRoundStatus error:",
        supervisorErr instanceof Error ? supervisorErr.message : supervisorErr
      );
    }
  }

  return { checked: activeMatches.length, completed };
};

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

export const assertCanCreateLichessGames = (): void => {
  if (!env.lichessApiToken) {
    throw new HttpError(
      500,
      "LICHESS_API_TOKEN is required (challenge:write scope) to create targeted Lichess games."
    );
  }
};
