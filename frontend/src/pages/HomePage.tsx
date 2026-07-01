import { api } from "../api";
import type { Page } from "../components/Navigation";
import type { Tournament, User } from "../types";

interface HomePageProps {
  user: User | null;
  activeTournament?: Tournament;
  onNavigate: (page: Page) => void;
}

export function HomePage({ user, activeTournament, onNavigate }: HomePageProps) {
  return (
    <section className="grid min-h-[calc(100vh-64px)] border-b border-burgundy/20 md:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
      <div className="flex items-center border-b border-burgundy/20 px-5 py-16 md:border-b-0 md:border-r md:px-8 bg-white">
        <div>
          <h1 className="text-[22vw] font-bold leading-none tracking-[-0.05em] text-[#800020] md:text-[15vw]">8x8</h1>
          <p className="mt-3 text-sm text-ink/55">Weekly blitz chess. Every Sunday.</p>
        </div>
      </div>
      <div className="chess-grid-bg flex items-center px-5 py-16 md:px-12">
        <div className="w-full max-w-xl">
          <img src="/logo.png" alt="8x8 Logo" className="h-[50vw] w-auto max-h-[320px] md:h-[24vw] mb-6" />
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-burgundy/50 mb-4">
            Every Sunday — 17:00 UTC
          </p>

          <div className="mb-8 grid grid-cols-3 gap-0 border border-burgundy/20">
            <div className="border-r border-burgundy/20 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">Format</p>
              <p className="mt-1 font-mono text-sm font-bold text-ink">3 Lives</p>
            </div>
            <div className="border-r border-burgundy/20 px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">Time</p>
              <p className="mt-1 font-mono text-sm font-bold text-ink">5+0 Blitz</p>
            </div>
            <div className="px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40">Rounds</p>
              <p className="mt-1 font-mono text-sm font-bold text-ink">11 Max</p>
            </div>
          </div>
          <div className="mb-8">
            <h2 className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[#800020] font-bold">Format</h2>
            <p className="text-[15px] leading-7 text-ink/70">
              Weekly blitz chess tournament. Every player enters with 3 strikes. Lose a game, lose 1 strike. Draw a game, lose 0.5 strikes. Lose all 3 strikes and you are eliminated. The last players standing win the arena.
            </p>
          </div>
          <div>
            {user ? (
              <button
                className="bg-burgundy px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white"
                type="button"
                onClick={() => onNavigate("tournaments")}
              >
                View Tournaments
              </button>
            ) : (
              <button
                className="inline-block bg-burgundy px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white"
                type="button"
                onClick={() => { window.location.href = api.authUrl; }}
              >
                Register with Lichess
              </button>
            )}
          </div>

        </div>
      </div>
    </section>
  );
}
