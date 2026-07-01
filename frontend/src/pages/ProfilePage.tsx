import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { User, UserProfile } from "../types";

interface ProfilePageProps {
  /** The currently logged-in user (to detect own-profile) */
  user: User | null;
  /** The lichess username whose profile to display */
  username: string;
  onLogout: () => void;
}

// Profile formatting and render helpers

const fmt = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

const StatRow = ({ label, value }: { label: string; value: string | number }) => (
  <tr className="border-b border-burgundy/10 last:border-0">
    <td className="py-2 pr-6 font-mono text-xs uppercase tracking-[0.08em] text-ink/50">
      {label}
    </td>
    <td className="py-2 text-right font-mono text-sm font-bold text-ink">
      {value}
    </td>
  </tr>
);

// Main Profile Component

export function ProfilePage({ user, username, onLogout }: ProfilePageProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Bio editing
  const [editingBio, setEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const isOwnProfile = user?.lichessUsername?.toLowerCase() === username.toLowerCase();

  // Fetch profile
  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .getUserProfile(username)
      .then((data) => {
        setProfile(data);
        setBioInput(data.user.bio ?? "");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [username]);

  // Focus textarea when edit opens
  useEffect(() => {
    if (editingBio) bioRef.current?.focus();
  }, [editingBio]);

  const saveBio = async () => {
    if (!profile) return;
    setBioSaving(true);
    setBioError(null);
    try {
      const resp = await api.updateBio(bioInput);
      setProfile((prev) =>
        prev ? { ...prev, user: { ...prev.user, bio: resp.user.bio } } : prev
      );
      setEditingBio(false);
    } catch (err) {
      setBioError(err instanceof Error ? err.message : "Failed to save bio.");
    } finally {
      setBioSaving(false);
    }
  };

  // Loading and Error states

  if (loading) {
    return (
      <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-8">
        <p className="font-mono text-sm text-ink/50 animate-pulse">Loading profile…</p>
      </section>
    );
  }

  if (error || !profile) {
    return (
      <section className="mx-auto max-w-[1440px] px-5 py-16 md:px-8">
        <div className="border-2 border-[#800020] p-8">
          <p className="font-mono text-sm text-[#800020]">
            {error ?? "Profile not found."}
          </p>
        </div>
      </section>
    );
  }

  const { user: p, stats, recentMatches } = profile;

  // Profile View Layout

  return (
    <section className="mx-auto max-w-[1440px] px-5 py-12 pb-24 md:px-8">

      {/* Identity Row */}
      <div className="mb-8 border-2 border-[#800020] bg-white">
        <div className="grid grid-cols-1 gap-0 divide-y divide-burgundy/20 md:grid-cols-2 md:divide-x md:divide-y-0">

          {/* LEFT: Name + rating + Lichess link */}
          <div className="p-8">
            <h1 className="text-4xl font-black tracking-tight text-ink">
              {p.lichessUsername}
            </h1>
            <p className="mt-1 font-mono text-lg font-bold text-[#800020]">
              {p.blitzRating ?? p.rating} Blitz
            </p>
            <a
              href={`https://lichess.org/@/${p.lichessUsername}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block font-mono text-xs text-ink/50 underline hover:text-[#800020] transition-colors"
            >
              View Lichess Profile ↗
            </a>
          </div>

          {/* RIGHT: Bio */}
          <div className="p-8">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
                Bio
              </p>
              {isOwnProfile && !editingBio && (
                <button
                  type="button"
                  onClick={() => setEditingBio(true)}
                  className="font-mono text-[10px] uppercase tracking-widest text-ink/40 hover:text-[#800020] transition-colors"
                >
                  Edit ✎
                </button>
              )}
            </div>

            {editingBio ? (
              <div className="space-y-2">
                <textarea
                  ref={bioRef}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full rounded-none border border-[#800020] bg-white px-3 py-2 text-sm text-ink outline-none focus:ring-1 focus:ring-[#800020] resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveBio}
                    disabled={bioSaving}
                    className="rounded-none bg-[#800020] px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-widest text-white hover:bg-[#600018] disabled:opacity-50"
                  >
                    {bioSaving ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBio(false);
                      setBioInput(profile.user.bio ?? "");
                      setBioError(null);
                    }}
                    className="rounded-none border border-ink/20 px-4 py-1.5 font-mono text-xs uppercase tracking-widest text-ink/50 hover:border-[#800020]"
                  >
                    Cancel
                  </button>
                </div>
                {bioError && (
                  <p className="text-xs font-mono text-[#800020] animate-fade-in">
                    {bioError}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-ink/70">
                {p.bio || (
                  <span className="italic text-ink/30">
                    {isOwnProfile ? "No bio yet — click Edit to add one." : "No bio."}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats and Match History Row */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Gladiator Stats */}
        <div className="space-y-6">

          {/* Block A: Tournament Record */}
          <div className="border border-burgundy/25 bg-white">
            <div className="border-b-2 border-[#800020] px-6 py-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">
                Tournament Record
              </h2>
            </div>
            <div className="px-6 py-4">
              <table className="w-full">
                <tbody>
                  <StatRow label="Tournaments Played"              value={stats.tournamentsPlayed} />
                  <StatRow label="Gauntlets Survived (11 Rounds)" value={stats.survived} />
                  <StatRow label="Arenas Eliminated"               value={stats.eliminated} />
                  <StatRow
                    label="Avg. Elimination Round"
                    value={stats.avgEliminationRound !== null ? stats.avgEliminationRound : "—"}
                  />
                </tbody>
              </table>
            </div>
          </div>

          {/* Block B: Strike Ledger */}
          <div className="border border-burgundy/25 bg-white">
            <div className="border-b-2 border-[#800020] px-6 py-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">
                Strike Ledger
              </h2>
            </div>
            <div className="px-6 py-4">
              <table className="w-full">
                <tbody>
                  <StatRow label="Strikes Taken from Opponents" value={stats.strikesTaken} />
                  <StatRow label="Strikes Conceded / Lost"      value={stats.strikesLost} />
                </tbody>
              </table>
            </div>
          </div>

          {/* Block C: Match Outcomes */}
          <div className="border border-burgundy/25 bg-white">
            <div className="border-b-2 border-[#800020] px-6 py-3">
              <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">
                Match Outcomes
              </h2>
            </div>
            <div className="px-6 py-4">
              <table className="w-full">
                <tbody>
                  <StatRow label="Wins"          value={stats.wins} />
                  <StatRow label="Draws"         value={stats.draws} />
                  <StatRow label="Losses"        value={stats.losses} />
                  <StatRow label="Forfeit Wins"  value={stats.forfeitWins} />
                  <StatRow label="Forfeit Losses" value={stats.forfeitLosses} />
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Matches */}
        <div className="border border-burgundy/25 bg-white">
          <div className="border-b-2 border-[#800020] px-6 py-3">
            <h2 className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#800020]">
              Recent games
            </h2>
          </div>

          {recentMatches.length === 0 ? (
            <div className="px-6 py-8 text-sm italic text-ink/40">
              No matches recorded in the arena yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-burgundy/20 font-mono text-[10px] uppercase tracking-[0.1em] text-burgundy">
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Rnd</th>
                    <th className="px-4 py-2 font-semibold">Opponent</th>
                    <th className="px-4 py-2 font-semibold">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-burgundy/10">
                  {recentMatches.map((m, i) => (
                    <tr key={i} className="hover:bg-[#fffafb] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-ink/50">
                        {fmt(m.date)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-ink/70">
                        {m.round}
                      </td>
                      <td className="px-4 py-2.5 text-ink/80">{m.opponent}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={[
                            "font-mono text-xs font-bold uppercase tracking-widest",
                            m.outcome === "WIN" || m.outcome === "FORFEIT WIN"
                              ? "text-ink"
                              : m.outcome === "LOSS" || m.outcome === "FORFEIT LOSS"
                              ? "text-ink/50"
                              : "text-ink/70"
                          ].join(" ")}
                        >
                          {m.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex items-center justify-between border-t border-burgundy/10 pt-8">
        <div>
          {isOwnProfile && (
            <button
              type="button"
              onClick={onLogout}
              className="font-mono text-sm font-bold uppercase tracking-[0.1em] text-burgundy hover:text-[#600018] underline transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
            Joined 8x8
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-ink">
            {fmt(p.createdAt)}
          </p>
        </div>
      </div>
    </section>
  );
}
