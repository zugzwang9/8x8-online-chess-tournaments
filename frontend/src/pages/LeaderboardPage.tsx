import { useEffect, useState } from "react";
import { api } from "../api";
import type { GlobalLeaderboardEntry } from "../types";

const PAGE_SIZE = 15;

export function LeaderboardPage() {
  const [entries, setEntries] = useState<GlobalLeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    api.getGlobalLeaderboard()
      .then((res) => setEntries(res.leaderboard))
      .catch((err) => console.error("Failed to load leaderboard", err))
      .finally(() => setIsLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageSlice = entries.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-burgundy border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 border-l-4 border-burgundy pl-4">
        <h1 className="font-mono text-2xl uppercase tracking-[0.15em] text-burgundy drop-shadow-sm">
          Global Leaderboard
        </h1>
        <p className="mt-2 text-sm text-ink/70">
          All-time rankings across all 8x8 tournaments.
        </p>
      </div>

      <div className="overflow-x-auto rounded border border-burgundy/20 bg-paper shadow-[0_4px_24px_-4px_rgba(128,0,32,0.1)]">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-burgundy/30 bg-burgundy/[0.03] font-mono text-[11px] uppercase tracking-[0.1em] text-burgundy">
              <th className="w-16 border-r border-burgundy/20 px-4 py-3 font-medium">Rank</th>
              <th className="border-r border-burgundy/20 px-4 py-3 font-medium">Player</th>
              <th className="border-r border-burgundy/20 px-4 py-3 font-medium">Rating</th>
              <th className="border-r border-burgundy/20 px-4 py-3 font-medium">W / L / D</th>
              <th className="border-r border-burgundy/20 px-4 py-3 font-medium text-center">Win %</th>
              <th className="px-4 py-3 font-medium text-center">Games</th>
            </tr>
          </thead>
          <tbody>
            {pageSlice.map((entry) => (
              <tr
                key={entry.user.id}
                className="border-b border-burgundy/10 transition-colors hover:bg-burgundy/[0.02]"
              >
                <td className="border-r border-burgundy/10 px-4 py-3 font-mono text-xs text-ink/50">
                  #{entry.rank}
                </td>
                <td className="border-r border-burgundy/10 px-4 py-3 font-medium">
                  <a
                    href={`https://lichess.org/@/${entry.user.lichessUsername}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline"
                  >
                    {entry.user.lichessUsername}
                  </a>
                </td>
                <td className="border-r border-burgundy/10 px-4 py-3 font-mono text-xs">
                  {entry.user.blitzRating ?? entry.user.rating}
                </td>
                <td className="border-r border-burgundy/10 px-4 py-3 font-mono text-xs whitespace-nowrap">
                  <span className="text-emerald-700">{entry.stats.wins}</span>
                  <span className="text-ink/30 mx-1">/</span>
                  <span className="text-rose-800">{entry.stats.losses}</span>
                  <span className="text-ink/30 mx-1">/</span>
                  <span className="text-ink/60">{entry.stats.draws}</span>
                </td>
                <td className="border-r border-burgundy/10 px-4 py-3 text-center font-mono text-xs">
                  {entry.stats.winPercentage}%
                </td>
                <td className="px-4 py-3 text-center font-mono text-xs text-ink/70">
                  {entry.stats.totalGames}
                </td>
              </tr>
            ))}
            {pageSlice.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/50">
                  No games have been completed yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="border border-burgundy/30 px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink/60 transition-colors hover:border-[#800020] hover:text-[#800020] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="font-mono text-xs text-ink/50">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={safePage >= totalPages - 1}
            className="border border-burgundy/30 px-4 py-2 font-mono text-xs uppercase tracking-widest text-ink/60 transition-colors hover:border-[#800020] hover:text-[#800020] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
