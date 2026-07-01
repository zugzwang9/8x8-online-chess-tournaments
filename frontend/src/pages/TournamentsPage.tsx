import { useEffect, useMemo, useState, useRef } from "react";
import { api } from "../api";
import { PlayerTable } from "../components/PlayerTable";
import { MatchTable } from "../components/MatchTable";

import { generateNineWeekSchedule } from "../utils/schedule";
import type { Standing, Tournament, TournamentLivePayload, User } from "../types";

interface TournamentsPageProps {
  user: User | null;
  tournaments: Tournament[];
  selectedTournamentId: string | null;
  onSelectTournament: (id: string | null) => void;
}

const getNextSundayAt1700UTC = (): Date => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay();
  const daysUntilSunday = (7 - day) % 7;
  
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  date.setUTCHours(17, 0, 0, 0);
  
  if (date.getTime() <= Date.now()) {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  return date;
};

const formatCountdown = (target: Date): string => {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) {
    return "Starts in: 00h 00m 00s";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `Starts in: ${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

export function TournamentsPage({
  user,
  tournaments,
  selectedTournamentId,
  onSelectTournament
}: TournamentsPageProps) {
  const schedule = useMemo(() => generateNineWeekSchedule(tournaments), [tournaments]);
  const upcomingSchedule = schedule.find((item) => item.tournament?.status === "UPCOMING") ?? schedule[0];
  const selectedScheduleById = schedule.find((item) => item.key === selectedTournamentId);
  const selectedSchedule = selectedScheduleById ?? upcomingSchedule;
  const selectedTournament = selectedSchedule?.tournament ?? null;

  // Prefer the DB value (registrationClosesAt) as the ground truth for the tournament
  // start time so the check-in window and countdown are always accurate.
  // Falls back to the schedule-derived date for unconfirmed future slots.
  const tournamentStartDate = useMemo(() => {
    if (selectedTournament?.registrationClosesAt) {
      return new Date(selectedTournament.registrationClosesAt);
    }
    return selectedSchedule?.date ?? getNextSundayAt1700UTC();
  }, [selectedTournament?.registrationClosesAt, selectedSchedule?.date]);

  const [live, setLive] = useState<TournamentLivePayload | null>(null);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [countdownText, setCountdownText] = useState<string>("Starts in: --h --m --s");
  const [roundTimerText, setRoundTimerText] = useState<string | null>(null);
  const [viewAllRounds, setViewAllRounds] = useState(false);
  const [matchModal, setMatchModal] = useState<{
    round: number;
    url: string;
    matchId: string;
  } | null>(null);
  const [eliminatedModal, setEliminatedModal] = useState(false);
  const [finishedModal, setFinishedModal] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; username: string; message: string; timestamp: number }>>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const showToast = (message: string, ms = 3000) => {
    setToast(message);
    window.setTimeout(() => setToast(null), ms);
  };

  useEffect(() => {
    let mounted = true;

    const fetchChat = async () => {
      if (!selectedTournament) return;
      try {
        const data = await api.getChat(selectedTournament.id);
        if (!mounted) return;
        setChatMessages(data.messages);
      } catch (err) {
        console.error("Failed to fetch chat messages:", err);
      }
    };

    fetchChat();

    if (!selectedTournament) return;
    const status = (live && live.tournament.id === selectedTournament.id)
      ? live.tournament.status
      : selectedTournament.status;

    let interval: number | undefined;
    const myStanding = live?.standings.find((s) => s.userId === user?.id);
    if (status === "UPCOMING" || status === "ACTIVE") {
      interval = window.setInterval(fetchChat, 4000);
    }

    return () => {
      mounted = false;
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [selectedTournament, live?.tournament?.status, live?.tournament?.id]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (!tournamentStartDate) {
      setCountdownText("Starts in: --h --m --s");
      return;
    }

    const updateCountdown = () => {
      const target = tournamentStartDate;
      setCountdownText(formatCountdown(target));
      
      // Check-in opens exactly 60 minutes before start
      const msUntilStart = target.getTime() - Date.now();
      const sixtyMinsMs = 60 * 60 * 1000;
      setIsCheckInOpen(msUntilStart > 0 && msUntilStart <= sixtyMinsMs);
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [tournamentStartDate]);

  // 15-minute round countdown (resets when live data round changes)
  useEffect(() => {
    if (!live || live.tournament.status !== "ACTIVE") {
      setRoundTimerText(null);
      return;
    }

    const roundStartedAt = live.tournament.roundStartedAt;
    if (!roundStartedAt) {
      setRoundTimerText("--:--");
      return;
    }

    const TIMEOUT_MS = 15 * 60 * 1000;

    const updateTimer = () => {
      const elapsed = Date.now() - new Date(roundStartedAt).getTime();
      const remaining = Math.max(0, TIMEOUT_MS - elapsed);

      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      setRoundTimerText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    };

    updateTimer();
    const interval = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(interval);
  }, [live?.tournament.roundStartedAt, live?.tournament.status]);

  // Show match-start modal when user has a PLAYING match in the current round
  useEffect(() => {
    if (!live || !user) return;
    const currentRound = live.tournament.currentRound;
    if (currentRound === 0 || live.tournament.status !== "ACTIVE") return;
    const userMatch = live.matches.find(
      (m) =>
        m.round === currentRound &&
        m.status === "PLAYING" &&
        (m.whitePlayer.id === user.id || m.blackPlayer.id === user.id)
    );
    if (!userMatch) return;
    const playUrl =
      userMatch.whitePlayer.id === user.id
        ? (userMatch.lichessWhiteUrl ?? userMatch.lichessChallengeUrl)
        : (userMatch.lichessBlackUrl ?? userMatch.lichessChallengeUrl);
    if (playUrl) {
      setMatchModal({ round: currentRound, url: playUrl, matchId: userMatch.id });
    }
  }, [live?.tournament.currentRound, user]);

  // Eliminated modal: fires once when the user's standing hits 0 lives.
  // Uses a ref rather than state so toggling it never causes a re-render loop.
  const eliminatedShownForTournament = useRef<string | null>(null);
  useEffect(() => {
    if (!live || !user) return;
    if (live.tournament.status !== "ACTIVE") return;
    const myStanding = live.standings.find((s) => s.userId === user.id);
    if (!myStanding) return;
    if (
      (myStanding.status === "ELIMINATED" || myStanding.lives === 0) &&
      eliminatedShownForTournament.current !== live.tournament.id
    ) {
      // Mark as shown for this tournament so refreshes don't re-trigger it
      eliminatedShownForTournament.current = live.tournament.id;
      setEliminatedModal(true);
    }
  }, [live?.standings, live?.tournament.status]);

  // Tournament-finished modal: fires for everyone when status becomes FINISHED.
  const finishedShownForTournament = useRef<string | null>(null);
  useEffect(() => {
    if (!live) return;
    if (
      live.tournament.status === "FINISHED" &&
      finishedShownForTournament.current !== live.tournament.id
    ) {
      finishedShownForTournament.current = live.tournament.id;
      setFinishedModal(true);
    }
  }, [live?.tournament.status]);

  useEffect(() => {
    if (!selectedTournament) {
      setLive(null);
      return;
    }

    let mounted = true;

    const load = async () => {
      try {
        const livePayload = await api.getTournamentLive(selectedTournament.id);
        if (!mounted) return;

        const standingsResp = await api.getTournamentStandings(selectedTournament.id);
        if (!mounted) return;

        setLive({ ...livePayload, standings: standingsResp.standings });
      } catch {
        if (!mounted) return;
        setLive(null);
      }
    };

    const hasMatchingLive = live && live.tournament.id === selectedTournament.id;
    if (!hasMatchingLive) {
      load();
    }

    const status = hasMatchingLive ? live.tournament.status : selectedTournament.status;
    const myStanding = live?.standings.find((s) => s.userId === user?.id);
    const isEliminated = myStanding?.status === "ELIMINATED";
    let interval: number | undefined;
    if (status !== "FINISHED" && !isEliminated) {
      const intervalMs = status === "ACTIVE" ? 8000 : 30000;
      interval = window.setInterval(load, intervalMs);
    }

    return () => {
      mounted = false;
      if (interval) window.clearInterval(interval);
    };
  }, [selectedTournament, user, live?.tournament?.status, live?.tournament?.id]);

  useEffect(() => {
    let mounted = true;
    const findUpcoming = async () => {
      try {
        const resp = await api.getUpcomingTournament();
        if (!mounted) return;
        if (resp.tournament && !selectedTournamentId) {
          onSelectTournament(resp.tournament.id);
        }
      } catch {
        // ignore fallback errors
      }
    };

    findUpcoming();
    return () => {
      mounted = false;
    };
  }, [selectedTournamentId, onSelectTournament]);

  const join = async () => {
    if (!user || !selectedTournament) {
      console.warn("join aborted: no user or no selectedTournament", { user, selectedTournament });
      return;
    }

    if (selectedTournament.status === "FINISHED") {
      showToast("Registration is closed for this tournament");
      console.warn("join aborted: tournament finished", { selectedTournament, selectedSchedule });
      return;
    }

    setIsJoining(true);

    try {
      await api.registerForTournament(selectedTournament.id);
      
      const targetDate = tournamentStartDate;
      const msUntilStart = targetDate.getTime() - Date.now();
      const sixtyMinsMs = 60 * 60 * 1000;
      
      let wasAutoCheckedIn = false;
      if (msUntilStart > 0 && msUntilStart <= sixtyMinsMs) {
        await api.checkInTournament(selectedTournament.id);
        wasAutoCheckedIn = true;
      }
      let updatedStandings: Standing[] = [];
      try {
        const standingsResp = await api.getTournamentStandings(selectedTournament.id);
        updatedStandings = standingsResp.standings;
      } catch (error) {
        updatedStandings = live?.standings ?? [];
      }
      setLive((prev) => ({
        ...(prev ?? { tournament: selectedTournament, matches: [], standings: [] }),
        standings: updatedStandings
      }));
      
      const formattedDate = `Sunday, ${targetDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
      if (wasAutoCheckedIn) {
        showToast(`Joined tournament ${formattedDate} - You have been auto checked-in.`, 8000);
      } else {
        showToast(`Joined tournament ${formattedDate} - Remember to check in 60 minutes before start.`, 8000);
      }
    } catch (error) {
      console.error("Registration failed:", error);
      showToast((error as Error).message || "Failed to register for tournament");
    } finally {
      setIsJoining(false);
    }
  };

  const leave = async () => {
    if (!user || !selectedTournament) {
      return;
    }

    if (selectedTournament.status === "FINISHED") {
      showToast("Cannot leave a finished tournament");
      return;
    }

    setIsLeaving(true);

    try {
      await api.leaveFromTournament(selectedTournament.id);
      showToast("Left tournament");

      let updatedStandings: Standing[] = [];
      try {
        const standingsResp = await api.getTournamentStandings(selectedTournament.id);
        updatedStandings = standingsResp.standings;
      } catch (error) {
        console.error("Failed to refresh standings after leaving:", error);
        updatedStandings = live?.standings?.filter((s) => s.userId !== user.id) ?? [];
      }

      setLive((prev) => ({
        ...(prev ?? { tournament: selectedTournament, matches: [], standings: [] }),
        standings: updatedStandings
      }));
    } catch (error) {
      console.error("Leave failed:", error);
      showToast("Failed to leave tournament");
    } finally {
      setIsLeaving(false);
    }
  };

  const checkIn = async () => {
    if (!selectedTournament) return;
    try {
      const resp = await api.checkInTournament(selectedTournament.id);
      showToast("Checked in successfully!");
      setLive(prev => ({
        ...(prev ?? { tournament: selectedTournament, matches: [], standings: [] }),
        standings: resp.standings
      }));
    } catch (error) {
      showToast("Failed to check in");
    }
  };

  const startTournament = async () => {
    if (!selectedTournament) return;

    try {
      await api.startTournament(selectedTournament.id);
      showToast("Tournament started!");
      
      const livePayload = await api.getTournamentLive(selectedTournament.id);
      const standingsResp = await api.getTournamentStandings(selectedTournament.id);
      setLive({ ...livePayload, standings: standingsResp.standings });
    } catch (error: any) {
      console.error("Failed to start tournament:", error);
      showToast(error.message || "Failed to start tournament");
    }
  };

  const stopTournament = async () => {
    if (!selectedTournament) return;

    try {
      await api.stopTournament(selectedTournament.id);
      showToast("Tournament stopped and reset!");
      
      const livePayload = await api.getTournamentLive(selectedTournament.id);
      const standingsResp = await api.getTournamentStandings(selectedTournament.id);
      setLive({ ...livePayload, standings: standingsResp.standings });
    } catch (error) {
      console.error("Failed to stop tournament:", error);
      showToast("Failed to stop tournament");
    }
  };

  const seedTestPlayersFn = async () => {
    if (!selectedTournament) return;

    try {
      const result = await api.seedTestPlayers(selectedTournament.id);
      showToast(result.seeded.length > 0 ? `Seeded: ${result.seeded.join(", ")}` : "All bots already registered");
      const livePayload = await api.getTournamentLive(selectedTournament.id);
      const standingsResp = await api.getTournamentStandings(selectedTournament.id);
      setLive({ ...livePayload, standings: standingsResp.standings });
    } catch (error: any) {
      console.error("Seed failed:", error);
      showToast(error.message || "Failed to seed test players");
    }
  };

  const fastForwardFn = async () => {
    if (!selectedTournament) return;

    try {
      const result = await api.fastForwardRound(selectedTournament.id);
      showToast("Fast-forwarded! Check logs for outcome.");
      console.info("[fast-forward]", result.message);
      // Give the supervisor a moment to settle then refresh
      await new Promise((r) => setTimeout(r, 1500));
      const livePayload = await api.getTournamentLive(selectedTournament.id);
      const standingsResp = await api.getTournamentStandings(selectedTournament.id);
      setLive({ ...livePayload, standings: standingsResp.standings });
    } catch (error: any) {
      console.error("Fast-forward failed:", error);
      showToast(error.message || "Failed to fast-forward round");
    }
  };

  const isUserRegistered = Boolean(
    selectedTournament &&
      user &&
      live?.standings.some((standing) => standing.userId === user.id)
  );

  const registrationClosed = Boolean(selectedTournament && selectedTournament.status === "FINISHED");

  const sendChat = async () => {
    if (!user || !chatInput.trim() || !selectedTournament) return;
    try {
      const resp = await api.sendChat(selectedTournament.id, chatInput);
      setChatMessages(resp.messages);
      setChatInput("");
    } catch (error: any) {
      showToast(error.message || "Failed to send chat message");
    }
  };

  return (
    <>
      {toast && (
        <div className="fixed right-4 top-20 z-50">
          <div className="rounded-sm px-5 py-3 bg-white text-[#800020] border-2 border-[#800020] shadow-xl font-bold text-xs uppercase tracking-[0.08em]">{toast}</div>
        </div>
      )}
      <section className="mx-auto max-w-[1440px] px-5 py-12 pb-[110px] md:px-8">
        {user?.isAdmin && selectedTournament && (
          <details className="group mb-8 rounded-none border-2 border-burgundy bg-[#fffafb] shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between p-6">
              <h2 className="text-lg font-bold tracking-[0.1em] text-burgundy uppercase">Admin Control Panel</h2>
              <span className="text-burgundy transition-transform duration-200 group-open:rotate-180">▼</span>
            </summary>
            <div className="px-6 pb-6 pt-0">
              <div className="mb-6 flex items-center justify-between border-b border-burgundy/10 pb-4 border-t pt-4">
              <span className="font-mono text-sm font-semibold uppercase tracking-[0.05em] text-ink/70">
                Current Status:{" "}
                <span
                  className={
                    (live?.tournament?.status ?? selectedTournament.status) === "ACTIVE"
                      ? "text-green-600"
                      : (live?.tournament?.status ?? selectedTournament.status) === "FINISHED"
                        ? "text-amber-600"
                        : "text-burgundy"
                  }
                >
                  {(live?.tournament?.status ?? selectedTournament.status) === "ACTIVE"
                    ? "RUNNING"
                    : (live?.tournament?.status ?? selectedTournament.status) === "FINISHED"
                      ? "FINISHED"
                      : "NOT RUNNING"}
                </span>
              </span>
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={startTournament}
                disabled={(live?.tournament?.status ?? selectedTournament.status) !== "UPCOMING"}
                className="flex-1 rounded-none bg-[#800020] px-6 py-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-burgundy disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Tournament
              </button>
              <button
                type="button"
                onClick={stopTournament}
                disabled={(
                  (live?.tournament?.status ?? selectedTournament.status) !== "ACTIVE" &&
                  (live?.tournament?.status ?? selectedTournament.status) !== "FINISHED"
                )}
                className="flex-1 rounded-none bg-[#800020] px-6 py-4 text-sm font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-burgundy disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Stop &amp; Reset
              </button>
            </div>

            {/* Dev / Testing utilities */}
            <div className="mt-4 border-t border-burgundy/10 pt-4">
              <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-[0.08em] text-ink/40">Dev Tools</p>
              <div className="flex gap-4">
                {import.meta.env.DEV && (
                  <>
                    <button
                      type="button"
                      onClick={seedTestPlayersFn}
                      disabled={(live?.tournament?.status ?? selectedTournament.status) !== "UPCOMING"}
                      className="flex-1 rounded-none border-2 border-[#800020] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#800020] transition-colors hover:bg-[#800020] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ⚙ Seed Test Players
                    </button>
                    <button
                      type="button"
                      onClick={fastForwardFn}
                      disabled={(live?.tournament?.status ?? selectedTournament.status) !== "ACTIVE"}
                      className="flex-1 rounded-none border-2 border-[#800020] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#800020] transition-colors hover:bg-[#800020] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ⏩ Fast-Forward 15 Mins
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const res = await api.retryLichessGames(selectedTournament.id);
                          showToast(res.message);
                        } catch (e: any) {
                          showToast(e.message);
                        }
                      }}
                      disabled={(live?.tournament?.status ?? selectedTournament.status) !== "ACTIVE"}
                      className="flex-1 rounded-none border-2 border-[#800020] bg-white px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[#800020] transition-colors hover:bg-[#800020] hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      ↻ Retry Lichess Pairs
                    </button>
                  </>
                )}
              </div>
            </div>
            </div>
          </details>
        )}


        <div className="rounded-sm border border-burgundy/30 bg-white p-6 shadow-sm">
          {selectedTournament ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-6 border-b border-burgundy/10 pb-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-burgundy/90">
                    {selectedTournament?.status === "ACTIVE" ? "Current Tournament" : "Tournament"}
                  </p>
                  <h2 className="mt-3 text-2xl font-bold text-[#800020]">
                    Sunday, {tournamentStartDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} —{" "}
                    {tournamentStartDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
                  </h2>
                  <p className="mt-2 text-sm font-semibold text-[#800020]">{countdownText}</p>
                </div>

                <div className="flex items-center justify-end gap-3">
                  {user ? (
                    isUserRegistered ? (
                      <div className="flex items-center gap-3">
                        {isCheckInOpen && selectedTournament.status === "UPCOMING" ? (
                          (live?.standings.find(s => s.userId === user.id)?.checkedIn) ? (
                            <span className="px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-green-600 bg-green-50 border border-green-200">
                              ✓ Checked In
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={checkIn}
                              className="animate-pulse rounded-sm px-6 py-3 text-sm font-bold uppercase tracking-[0.08em] bg-green-600 text-white hover:bg-green-700"
                            >
                              Check In Now
                            </button>
                          )
                        ) : null}
                        
                        <button
                          type="button"
                          onClick={leave}
                          disabled={isLeaving}
                          className="rounded-sm px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] bg-white border border-ink/20 text-ink/80 hover:bg-ink/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isLeaving ? "Leaving..." : "Leave"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={join}
                        disabled={isJoining}
                        className="rounded-sm px-6 py-3 text-sm font-semibold uppercase tracking-[0.08em] bg-[#800020] text-white hover:bg-burgundy disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isJoining ? "Joining..." : "Join"}
                      </button>
                    )
                  ) : (
                    <div className="text-sm text-ink/60">Sign in to register for tonight’s event.</div>
                  )}
                </div>
              </div>

              {/* Header stats */}
              <div className="flex flex-wrap gap-3">
                {live?.tournament.status === "ACTIVE" && (
                  <>
                    <div className="flex items-center gap-2 border border-burgundy/20 bg-[#fff5f6] px-4 py-2">
                      <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink/50">Round timer</span>
                      <span className="font-mono text-sm font-bold text-[#800020]">
                        {roundTimerText ?? "--:--"}
                      </span>
                    </div>

                  </>
                )}
              </div>

              <div className="grid gap-6 xl:grid-cols-[70%_30%]">
                <div className="space-y-6">
                  {live && live.matches.length > 0 && (
                    <div className="border border-burgundy/20 bg-white p-6 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-xl font-semibold text-[#800020]">Current Matches</h3>
                        {live.tournament.currentRound > 1 && (
                          <button
                            type="button"
                            onClick={() => setViewAllRounds(!viewAllRounds)}
                            className="text-xs font-mono uppercase tracking-widest text-[#800020] hover:underline"
                          >
                            {viewAllRounds ? "Show Current Round" : "View All Rounds"}
                          </button>
                        )}
                      </div>
                      <MatchTable
                        allMatches={viewAllRounds ? live.matches : live.matches.filter(m => m.round === live.tournament.currentRound)}
                        currentRound={live.tournament.currentRound}
                        currentUser={user}
                      />
                    </div>
                  )}
                  <div className="border border-burgundy/20 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 text-xl font-semibold text-[#800020]">Participants</h3>
                    <PlayerTable standings={live?.standings ?? []} currentUserId={user?.id} />
                  </div>
                </div>

                <div className="rounded-sm border border-burgundy/20 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 text-xl font-semibold text-[#800020]">Live Chat</h3>
                  <div
                    ref={chatScrollRef}
                    className="mb-4 h-[320px] overflow-y-auto rounded-sm border border-burgundy/10 bg-[#fff5f6] p-4 text-sm text-ink/80"
                  >
                    {chatMessages.map((entry) => (
                      <div key={entry.id} className="mb-3 last:mb-0">
                        <span className="font-semibold text-burgundy">{entry.username}:</span>{" "}
                        <span>{entry.message}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <input
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      disabled={!user}
                      placeholder={user ? "Send a quick update..." : "Log in to chat"}
                      className="w-full rounded-sm border border-burgundy/20 bg-white px-3 py-2 text-sm outline-none focus:border-[#800020]"
                    />
                    <button
                      type="button"
                      onClick={sendChat}
                      disabled={!user || !chatInput.trim()}
                      className="w-full rounded-sm bg-[#800020] px-4 py-2 text-sm font-semibold uppercase tracking-[0.08em] text-white disabled:cursor-not-allowed disabled:bg-burgundy/40"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-sm border border-burgundy/20 bg-[#fffafb] p-6 text-sm leading-7 text-ink/80">
                <p className="mb-3 font-semibold text-[#800020]">Format</p>
                <p>
                  Weekly blitz chess tournament. Every player enters with 3 strikes. Lose a game, lose 1 strike. Draw a game, lose 0.5 strikes. Lose all 3 strikes and you are eliminated. The last players standing win the arena.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-sm border border-burgundy/20 bg-white p-6 text-sm text-ink/70">
              No upcoming tournament is available right now.
            </div>
          )}
        </div>
      </section>

      <div className="fixed left-0 right-0 bottom-0 h-[50px] border-t border-burgundy/20 bg-white z-40">
        <div className="mx-auto flex h-full w-full max-w-[1440px]">
          {schedule.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectTournament(item.key)}
              className={`flex-1 min-w-0 flex flex-col items-center justify-center text-center px-3 ${
                idx < schedule.length - 1 ? "border-r border-burgundy/10" : ""
              } ${selectedSchedule?.key === item.key ? "bg-[#800020]/10 text-[#800020]" : "bg-white text-ink/70"}`}
            >
              <div className="text-xs leading-4 font-semibold">
                {item.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="text-[10px] uppercase tracking-[0.08em]">
                {item.tournament ? (
                  item.tournament.status === "ACTIVE" ? (
                    <span><span className="text-green-600">●</span> ACTIVE</span>
                  ) : item.tournament.status === "FINISHED" ? (
                    "FINISHED"
                  ) : (
                    "OPEN"
                  )
                ) : (
                  "SCHEDULED"
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
      {/* Match-start modal */}
      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-full max-w-sm border-2 border-[#800020] bg-white p-8 shadow-2xl">
            <button
              type="button"
              onClick={() => setMatchModal(null)}
              className="absolute right-4 top-3 font-mono text-xs text-ink/40 hover:text-[#800020] transition-colors"
              aria-label="Dismiss"
            >
              ✕
            </button>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/40">
              Round {matchModal.round} — Match Alert
            </p>
            <h2 className="mb-6 text-xl font-bold text-[#800020]">
              Your Round {matchModal.round} match has started.
            </h2>
            <button
              type="button"
              onClick={() => {
                api.joinMatchCheck(matchModal.matchId).catch(() => {});
                window.open(matchModal.url, "_blank", "noreferrer");
                setMatchModal(null);
              }}
              className="w-full bg-[#800020] py-3 font-bold uppercase tracking-[0.1em] text-white transition-colors hover:bg-[#600018]"
            >
              Launch Match
            </button>
          </div>
        </div>
      )}

      {/* Eliminated modal */}
      {eliminatedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-none border-4 border-[#800020] bg-white p-10 shadow-2xl">
            <p className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-ink/40">
              [ ▢ ▢ ▢ ]
            </p>
            <h2 className="mb-4 text-3xl font-black uppercase tracking-tight text-[#800020]">
              Eliminated
            </h2>
            <p className="mb-8 text-sm leading-6 text-ink/70">
              You have lost all 3 square strikes and have been removed from the
              arena. You can no longer be paired for future rounds, but you can
              still view live matches and use the chat.
            </p>
            <button
              type="button"
              onClick={() => setEliminatedModal(false)}
              className="w-full rounded-none bg-[#800020] py-3 font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#600018]"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Tournament-finished modal ─────────────────────────────────────── */}
      {finishedModal && live && (() => {
        const survivors = [...(live.standings ?? [])]
          .filter((s) => s.lives > 0)
          .sort((a, b) =>
            b.lives !== a.lives ? b.lives - a.lives : b.points - a.points
          );

        const strikeIcons = (lives: number) =>
          [0, 1, 2]
            .map((i) => (lives >= i + 1 ? "■" : lives > i ? "◧" : "▢"))
            .join(" ");

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="relative w-full max-w-xl rounded-none border-2 border-[#800020] bg-white p-10 shadow-2xl">
              <h2 className="mb-1 text-2xl font-black uppercase tracking-tight text-[#800020]">
                Tournament Concluded
              </h2>
              <p className="mb-1 font-mono text-xs uppercase tracking-[0.15em] text-ink/40">
                The Survivors
              </p>
              <p className="mb-6 text-sm leading-6 text-ink/60">
                The 11-round Gladiator gauntlet has ended. The following players
                successfully defended their strikes and survived the arena:
              </p>

              {survivors.length === 0 ? (
                <p className="mb-6 text-sm italic text-ink/50">
                  No survivors — everyone was eliminated.
                </p>
              ) : (
                <div className="mb-6 overflow-hidden border border-burgundy/20">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-burgundy/20 bg-[#fff5f6] font-mono text-[10px] uppercase tracking-[0.1em] text-burgundy">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Player</th>
                        <th className="px-3 py-2">Strikes Left</th>
                        <th className="px-3 py-2 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-burgundy/10">
                      {survivors.map((s, idx) => (
                        <tr
                          key={s.id}
                          className={idx === 0 ? "bg-[#800020]/5" : ""}
                        >
                          <td className="px-3 py-2.5 font-mono text-xs text-ink/50">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2.5 font-semibold text-ink">
                            {s.user.lichessUsername}
                            {idx === 0 && (
                              <span className="ml-2 font-mono text-[9px] uppercase tracking-widest text-[#800020]">
                                champion
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs">
                            [ {strikeIcons(s.lives)} ]
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs">
                            {s.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setFinishedModal(false);
                  window.location.hash = "#leaderboard";
                }}
                className="w-full rounded-none bg-[#800020] py-3 font-bold uppercase tracking-[0.15em] text-white transition-colors hover:bg-[#600018]"
              >
                Close &amp; View Leaderboard
              </button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
