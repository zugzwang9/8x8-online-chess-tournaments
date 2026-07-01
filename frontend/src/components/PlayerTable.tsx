import { useState } from "react";
import type { Standing } from "../types";

interface PlayerTableProps {
  standings: Standing[];
  currentUserId?: string;
}

const PAGE_SIZE = 15;

const sortedStandings = (standings: Standing[], sortBy: "standard" | "leaderboard") =>
  [...standings].sort((a, b) => {
    // WINNER > ACTIVE > ELIMINATED
    const rank = (s: Standing) =>
      s.status === "WINNER" ? 0 : s.status === "ACTIVE" ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);

    if (sortBy === "leaderboard") {
      const winsA = a.stats?.wins ?? 0;
      const winsB = b.stats?.wins ?? 0;
      if (winsA !== winsB) return winsB - winsA;

      const takenA = a.stats?.livesTaken ?? 0;
      const takenB = b.stats?.livesTaken ?? 0;
      if (takenA !== takenB) return takenB - takenA;
      
      if (a.points !== b.points) return b.points - a.points;
    } else {
      if (a.lives !== b.lives) return b.lives - a.lives;
      if (a.points !== b.points) return b.points - a.points;
    }

    const ratingA = a.user.blitzRating ?? a.user.rating;
    const ratingB = b.user.blitzRating ?? b.user.rating;
    if (ratingA !== ratingB) return ratingB - ratingA;
    return a.user.lichessUsername.localeCompare(b.user.lichessUsername);
  });

const strikeMarks = (lives: number) => {
  const marks = [0, 1, 2].map((i) => {
    let type = "empty";
    if (lives >= i + 1) type = "full";
    else if (lives > i) type = "half";
    return (
      <svg key={i} width="11" height="11" viewBox="0 0 10 10" className="inline-block">
        {type === "full" && <rect width="10" height="10" className="fill-current" />}
        
        {type === "empty" && (
          <rect x="1" y="1" width="8" height="8" className="fill-transparent stroke-current stroke-[2]" />
        )}
        
        {type === "half" && (
          <>
            {/* The right-side outline */}
            <rect x="1" y="1" width="8" height="8" className="fill-transparent stroke-current stroke-[2]" />
            {/* The left-side solid fill */}
            <rect x="0" y="0" width="5" height="10" className="fill-current" />
          </>
        )}
      </svg>
    );
  });
  return (
    <span aria-label={`${lives} strikes remaining`} className="inline-flex items-center gap-[5px] font-mono">
      <span className="text-ink/60">[</span>
      <span className="flex items-center gap-[3px]">{marks}</span>
      <span className="text-ink/60">]</span>
    </span>
  );
};

export function PlayerTable({ standings, currentUserId }: PlayerTableProps) {
  const [page, setPage] = useState(0);
  const [viewMode, setViewMode] = useState<"standard" | "leaderboard">("standard");
  const sorted = sortedStandings(standings, viewMode);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="mb-4 flex gap-4">
        <button
          onClick={() => setViewMode("standard")}
          className={`px-3 py-1 font-mono text-xs uppercase tracking-widest transition-colors ${
            viewMode === "standard"
              ? "border-b-2 border-burgundy text-burgundy font-bold"
              : "text-ink/50 hover:text-ink/80"
          }`}
        >
          Standings
        </button>
        <button
          onClick={() => setViewMode("leaderboard")}
          className={`px-3 py-1 font-mono text-xs uppercase tracking-widest transition-colors ${
            viewMode === "leaderboard"
              ? "border-b-2 border-burgundy text-burgundy font-bold"
              : "text-ink/50 hover:text-ink/80"
          }`}
        >
          Leaderboard
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-y border-burgundy/30 font-mono text-[11px] uppercase tracking-[0.1em] text-burgundy">
              <th className="w-10 border-r border-burgundy/20 px-2 py-2 font-medium">#</th>
              <th className="border-r border-burgundy/20 px-2 py-2 font-medium">Player</th>
              <th className="border-r border-burgundy/20 px-2 py-2 font-medium">Rating</th>
              <th className="border-r border-burgundy/20 px-2 py-2 font-medium">Pts</th>
              {viewMode === "leaderboard" && (
                <>
                  <th className="border-r border-burgundy/20 px-2 py-2 font-medium">W/L/D</th>
                  <th className="border-r border-burgundy/20 px-2 py-2 font-medium whitespace-nowrap">L. Taken</th>
                </>
              )}
              <th className="px-2 py-2 font-medium">Strikes</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((standing, idx) => {
              const globalRank = safePage * PAGE_SIZE + idx + 1;
              const eliminated = standing.status === "ELIMINATED";
              const isWinner = standing.status === "WINNER";
              const isMe = standing.userId === currentUserId;
              return (
                <tr
                  key={standing.id}
                  className={[
                    "border-b border-burgundy/10 transition-colors",
                    eliminated ? "text-ink/30" : "text-ink",
                    isMe ? "bg-[#800020]/5" : "",
                  ].join(" ")}
                >
                  <td className="border-r border-burgundy/10 px-2 py-2 font-mono text-xs text-ink/50">
                    {globalRank}
                  </td>
                  <td className="border-r border-burgundy/10 px-2 py-2">
                    <a
                      href={`https://lichess.org/@/${standing.user.lichessUsername}`}
                      target="_blank"
                      rel="noreferrer"
                      className={[
                        eliminated ? "line-through decoration-ink/30 decoration-1" : "font-medium",
                        isWinner ? "text-[#800020]" : "",
                        isMe ? "font-bold" : "",
                        "hover:underline"
                      ].join(" ")}
                    >
                      {standing.user.lichessUsername}
                    </a>
                    {isWinner && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-[#800020]">
                        winner
                      </span>
                    )}
                    {isMe && !isWinner && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-[#800020]/60">
                        you
                      </span>
                    )}
                  </td>
                  <td className="border-r border-burgundy/10 px-2 py-2 font-mono text-xs">
                    {standing.user.blitzRating ?? standing.user.rating}
                  </td>
                  <td className="border-r border-burgundy/10 px-2 py-2 font-mono text-xs">
                    {standing.points}
                  </td>
                  {viewMode === "leaderboard" && (
                    <>
                      <td className="border-r border-burgundy/10 px-2 py-2 font-mono text-xs whitespace-nowrap">
                        <span className="text-emerald-700">{standing.stats?.wins ?? 0}</span>
                        <span className="text-ink/30 mx-1">/</span>
                        <span className="text-rose-800">{standing.stats?.losses ?? 0}</span>
                        <span className="text-ink/30 mx-1">/</span>
                        <span className="text-ink/60">{standing.stats?.draws ?? 0}</span>
                      </td>
                      <td className="border-r border-burgundy/10 px-2 py-2 font-mono text-xs">
                        {standing.stats?.livesTaken ?? 0}
                      </td>
                    </>
                  )}
                  <td className="px-2 py-2">{strikeMarks(standing.lives)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination controls — only shown when there are multiple pages */}
      {totalPages > 1 && (
        <div className="mt-3 flex items-center gap-2 border-t border-burgundy/10 pt-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="border border-burgundy/30 px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink/60 hover:border-[#800020] hover:text-[#800020] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          <span className="flex-1 text-center font-mono text-xs text-ink/50">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="border border-burgundy/30 px-3 py-1 font-mono text-xs uppercase tracking-widest text-ink/60 hover:border-[#800020] hover:text-[#800020] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
