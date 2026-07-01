import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { Navigation, type Page } from "./components/Navigation";

import { ChessPieceBackground } from "./components/ChessPieceBackground";
import { AboutPage } from "./pages/AboutPage";
import { HomePage } from "./pages/HomePage";
import { ProfilePage } from "./pages/ProfilePage";
import { TournamentsPage } from "./pages/TournamentsPage";
import { LeaderboardPage } from "./pages/LeaderboardPage";
import { findActiveTournament } from "./utils/schedule";
import type { Tournament, User } from "./types";

function App() {
  const [page, setPage] = useState<Page>(() => {
    const saved = window.localStorage.getItem("gladiator.page");
    const validPages: Page[] = ["home", "tournaments", "leaderboard", "about", "profile"];
    if (validPages.includes(saved as Page)) {
      return saved as Page;
    }
    return "home";
  });
  const [user, setUser] = useState<User | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const navigate = (newPage: Page) => {
    window.localStorage.setItem("gladiator.page", newPage);
    window.location.hash = `#${newPage}`;
    setPage(newPage);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    window.localStorage.removeItem("gladiator.page");
    setUser(null);
    setPage("home");
  };

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1) as Page;
      if (["home", "tournaments", "leaderboard", "about", "profile"].includes(hash)) {
        setPage(hash);
        window.localStorage.setItem("gladiator.page", hash);
      }
    };
    
    window.addEventListener("hashchange", handleHashChange);
    
    // Initial sync
    if (window.location.hash) {
      handleHashChange();
    } else if (page) {
      window.location.hash = `#${page}`;
    }

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [page]);

  useEffect(() => {
    // Call getMe unconditionally. If the cookie or token is present, it will log us in.
    api
      .getMe()
      .then(({ user }) => setUser(user))
      .catch(() => {
        if (page === "profile") {
          navigate("home");
        }
      })
      .finally(() => setIsInitializing(false));
  }, []);

  useEffect(() => {
    api
      .listTournaments()
      .then(({ tournaments: remoteTournaments }) => {
        if (remoteTournaments.length > 0) {
          setTournaments(remoteTournaments);
          
          // Sort upcoming tournaments so the soonest date is first
          const upcomingTournaments = remoteTournaments.filter((t) => t.status === "UPCOMING");
          upcomingTournaments.sort((a, b) => new Date(a.registrationClosesAt!).getTime() - new Date(b.registrationClosesAt!).getTime());
          const nextUpcoming = upcomingTournaments[0];
          setSelectedTournamentId(
            nextUpcoming?.id ?? remoteTournaments.find((tournament) => tournament.status === "ACTIVE")?.id ?? remoteTournaments[0].id
          );
        }
      })
      .catch(() => undefined);
  }, []);

  const activeTournament = useMemo(() => findActiveTournament(tournaments), [tournaments]);

  const registerForUpcoming = async () => {
    if (!user) {
      return;
    }

    try {
      const resp = await api.getUpcomingTournament();
      const upcomingTournament = resp.tournament ?? tournaments.find((tournament) => tournament.status === "UPCOMING") ?? tournaments[0];
      if (!upcomingTournament) return;

      await api.registerForTournament(upcomingTournament.id);

      setSelectedTournamentId(upcomingTournament.id);
      navigate("tournaments");
    } catch {
      // fallback to local tournaments if API fails
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-ink border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper text-ink">
      <Navigation activePage={page} onNavigate={navigate} user={user} />
      <main className="pt-14 chess-grid-bg min-h-screen" style={{ position: "relative" }}>
        <ChessPieceBackground />
        <div style={{ position: "relative", zIndex: 1 }}>
          {page === "home" && (
            <HomePage
              user={user}
              activeTournament={activeTournament}
              onNavigate={navigate}
            />
          )}
          {page === "tournaments" && (
            <TournamentsPage
              user={user}
              tournaments={tournaments}
              selectedTournamentId={selectedTournamentId}
              onSelectTournament={setSelectedTournamentId}
            />
          )}
          {page === "leaderboard" && <LeaderboardPage />}
          {page === "about" && <AboutPage />}
          {page === "profile" && user && (
            <ProfilePage user={user} username={user.lichessUsername} onLogout={logout} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
