export type Page = "home" | "tournaments" | "leaderboard" | "about" | "profile";

const navItems: Array<{ id: Page; label: string }> = [
  { id: "tournaments", label: "Tournaments" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "about", label: "About" }
];

import type { User } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface NavigationProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  user?: User | null;
}

export function Navigation({ activePage, onNavigate, user }: NavigationProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#800020]">
      <div className="mx-auto flex min-h-16 max-w-[1440px] items-center justify-between gap-5 px-5 py-2 md:px-8">
        <nav aria-label="Primary" className="flex items-center gap-2 text-[13px] text-white">
          <button
            type="button"
            onClick={() => onNavigate("home")}
            className="mr-3 hover:opacity-80 transition-opacity"
            aria-label="Home"
          >
            <img src="/logo.png" alt="8x8 Logo" className="h-12 w-auto brightness-0 invert" />
          </button>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`border px-4 py-2 ${
                activePage === item.id
                  ? "border-white/20 bg-white/20 text-white"
                  : "border-white/20 bg-[#800020] text-white/80 hover:bg-white/10"
              }`}
              type="button"
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="flex items-center">
          {user ? (
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="text-right hover:opacity-75 transition-opacity"
            >
              <div className="text-sm font-semibold text-white leading-tight">
                {user.lichessUsername}
              </div>
              <div className="text-[11px] text-white/65 leading-tight">
                {user.blitzRating ?? user.rating} Rating
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => window.location.href = `${API_BASE_URL}/auth/lichess`}
              className="border border-white/30 px-4 py-2 font-mono text-[12px] uppercase tracking-[0.08em] text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              Sign in with Lichess
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
