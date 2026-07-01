import { useEffect, useState } from "react";
import { api } from "../api";
import type { TournamentMatch, User } from "../types";

interface MatchTableProps {
  /** All matches across ALL rounds for this tournament */
  allMatches: TournamentMatch[];
  /** The round that is currently live / running */
  currentRound: number;
  /** Total rounds in the format (default 11) */
  maxRounds?: number;
  currentUser: User | null;
}

const VISIBLE_OTHER_BOARDS = 9; // user's match + 9 others = 10 max visible

export function MatchTable({
  allMatches,
  currentRound,
  maxRounds = 11,
  currentUser
}: MatchTableProps) {
  // viewedRound: which round the user is browsing (defaults to live round)
  const [viewedRound, setViewedRound] = useState<number>(currentRound);

  // Auto-advance viewedRound when the live round increments
  useEffect(() => {
    setViewedRound(currentRound);
  }, [currentRound]);

  // Extracts and sorts all available round numbers.
  const availableRounds = Array.from(
    new Set(allMatches.map((m) => m.round))
  ).sort((a, b) => a - b);

  // Filters matches for the currently viewed round.
  const isHistorical = viewedRound < currentRound;
  const roundMatches = allMatches.filter((m) => m.round === viewedRound);

  // Sorts the matches, prioritizing the user's live match.
  const userMatch =
    !isHistorical && currentUser
      ? roundMatches.find(
          (m) =>
            m.whitePlayer.id === currentUser.id ||
            m.blackPlayer.id === currentUser.id
        )
      : undefined;

  const otherMatches = roundMatches
    .filter((m) => m.id !== userMatch?.id)
    .slice(0, VISIBLE_OTHER_BOARDS);

  // Configures the visible matches based on historical or live view.
  const visibleMatches = isHistorical
    ? roundMatches
    : userMatch
    ? [userMatch, ...otherMatches]
    : otherMatches;

  const getPlayUrl = (match: TournamentMatch): string | null => {
    if (!currentUser) return match.lichessChallengeUrl ?? null;
    if (match.whitePlayer.id === currentUser.id && match.lichessWhiteUrl)
      return match.lichessWhiteUrl;
    if (match.blackPlayer.id === currentUser.id && match.lichessBlackUrl)
      return match.lichessBlackUrl;
    return match.lichessChallengeUrl ?? null;
  };

  const handlePlayMatch = (matchId: string, url: string) => {
    api.joinMatchCheck(matchId).catch(() => {});
    window.open(url, "_blank", "noreferrer");
  };

  return (
    <div>
      {/* Round navigation bar */}
      {availableRounds.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          {availableRounds.map((r) => {
            const isActive = r === viewedRound;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setViewedRound(r)}
                className={
                  isActive
                    ? "bg-[#800020] text-white rounded-none px-4 py-2 text-sm font-bold"
                    : "border border-neutral-300 text-neutral-700 bg-transparent rounded-none px-4 py-2 text-sm hover:border-[#800020] hover:text-[#800020] transition-colors"
                }
              >
                Round {r}
                {r === currentRound && !isActive && (
                  <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-green-500 align-middle" />
                )}
              </button>
            );
          })}

          {/* Rounds-left indicator */}
          <span className="ml-auto font-mono text-xs text-neutral-400">
            {currentRound}/{maxRounds} rounds
          </span>
        </div>
      )}

      {/* Historical banner */}
      {isHistorical && (
        <div className="mb-4 flex items-center gap-2 border-l-2 border-[#800020] bg-[#fff5f6] px-4 py-2 text-xs font-mono uppercase tracking-widest text-[#800020]">
          Historical results — Round {viewedRound}
        </div>
      )}

      {/* Match table */}
      {visibleMatches.length === 0 ? (
        <div className="border border-burgundy/10 bg-[#fff5f6] p-4 text-sm text-ink/60">
          No matches for Round {viewedRound}.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-burgundy/20 bg-white">
            <table className="w-full text-left text-sm text-ink/80">
              <thead className="border-b border-burgundy/20 bg-[#fff5f6] text-[11px] uppercase tracking-[0.08em] text-burgundy">
                <tr>
                  <th className="w-14 px-3 py-2 font-semibold">Board</th>
                  <th className="px-3 py-2 font-semibold">White</th>
                  <th className="px-3 py-2 font-semibold">Black</th>
                  <th className="w-16 px-3 py-2 font-semibold">Result</th>
                  {!isHistorical && (
                    <th className="w-24 px-3 py-2 text-right font-semibold">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-burgundy/10">
                {visibleMatches.map((match, idx) => {
                  const isWhite = currentUser?.id === match.whitePlayer.id;
                  const isBlack = currentUser?.id === match.blackPlayer.id;
                  const isUserMatch = isWhite || isBlack;
                  const playUrl = getPlayUrl(match);

                  return (
                    <tr
                      key={match.id}
                      className={[
                        "transition-colors",
                        isUserMatch && !isHistorical
                          ? "border-l-2 border-l-[#800020] bg-[#800020]/5"
                          : "hover:bg-[#fffafb]"
                      ].join(" ")}
                    >
                      {/* Board number / YOU label */}
                      <td className="px-3 py-2.5 font-mono text-xs text-ink/50">
                        {isUserMatch && !isHistorical ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[#800020]">
                            YOU
                          </span>
                        ) : (
                          idx + 1
                        )}
                      </td>

                      {/* White player */}
                      <td
                        className={`px-3 py-2.5 ${
                          isWhite && !isHistorical
                            ? "font-bold text-[#800020]"
                            : ""
                        }`}
                      >
                        {match.whitePlayer.lichessUsername}
                        <span className="ml-1 text-xs text-ink/40">
                          ({match.whitePlayer.rating})
                        </span>
                      </td>

                      {/* Black player */}
                      <td
                        className={`px-3 py-2.5 ${
                          isBlack && !isHistorical
                            ? "font-bold text-[#800020]"
                            : ""
                        }`}
                      >
                        {match.blackPlayer.lichessUsername}
                        <span className="ml-1 text-xs text-ink/40">
                          ({match.blackPlayer.rating})
                        </span>
                      </td>

                      {/* Result */}
                      <td className="px-3 py-2.5 font-mono text-xs">
                        {match.result === "PENDING" && (
                          <span className="italic text-ink/40">—</span>
                        )}
                        {match.result === "WHITE_WIN" && (
                          <span className="font-bold">1–0</span>
                        )}
                        {match.result === "BLACK_WIN" && (
                          <span className="font-bold">0–1</span>
                        )}
                        {match.result === "DRAW" && (
                          <span className="font-bold">½–½</span>
                        )}
                        {match.result === "FORFEIT" && (
                          <span className="font-bold text-red-600">FF</span>
                        )}
                      </td>

                      {/* Action column (live rounds only) */}
                      {!isHistorical && (
                        <td className="px-3 py-2.5 text-right">
                          {isUserMatch && match.status === "PLAYING" && playUrl ? (
                            <button
                              type="button"
                              onClick={() => handlePlayMatch(match.id, playUrl)}
                              className="bg-[#800020] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#600018]"
                            >
                              Play
                            </button>
                          ) : !isUserMatch && match.status === "PLAYING" && match.lichessGameId ? (
                            <details className="group relative inline-block text-left">
                              <summary className="cursor-pointer list-none rounded-sm border border-[#800020] bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#800020] transition-colors hover:bg-[#800020] hover:text-white">
                                Watch
                              </summary>
                              <div className="absolute right-0 top-full z-50 mt-2 w-[300px] rounded-sm border border-burgundy/20 bg-white p-2 shadow-xl">
                                <div className="mb-2 flex justify-between items-center px-1">
                                  <span className="text-xs font-bold text-ink">Live Board</span>
                                  <a 
                                    href={`https://lichess.org/${match.lichessGameId}`} 
                                    target="_blank" 
                                    rel="noreferrer" 
                                    className="text-[10px] uppercase tracking-wider text-burgundy hover:underline"
                                  >
                                    Open in Lichess ↗
                                  </a>
                                </div>
                                <iframe 
                                  src={`https://lichess.org/embed/${match.lichessGameId}?theme=auto&bg=auto`} 
                                  width="100%" 
                                  height="340" 
                                  frameBorder="0"
                                  className="rounded-sm bg-neutral-100"
                                />
                              </div>
                            </details>
                          ) : match.status === "COMPLETED" ? (
                            match.lichessGameId ? (
                              <a
                                href={`https://lichess.org/${match.lichessGameId}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[10px] uppercase tracking-widest text-burgundy hover:underline"
                              >
                                View on Lichess ↗
                              </a>
                            ) : (
                              <span className="font-mono text-[10px] uppercase tracking-widest text-ink/35">
                                Done
                              </span>
                            )
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Overflow notice */}
          {!isHistorical &&
            roundMatches.length >
              VISIBLE_OTHER_BOARDS + (userMatch ? 1 : 0) && (
              <div className="border-t border-burgundy/10 px-4 py-2 text-center font-mono text-xs text-ink/40">
                +
                {roundMatches.length -
                  VISIBLE_OTHER_BOARDS -
                  (userMatch ? 1 : 0)}{" "}
                more board(s) not shown
              </div>
            )}
        </>
      )}
    </div>
  );
}
