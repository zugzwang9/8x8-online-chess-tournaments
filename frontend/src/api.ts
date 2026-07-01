import type { Standing, Tournament, TournamentLivePayload, User, UserProfile } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";


const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    let errorMsg = `API ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body.error) {
        // Handle both standard and string-based error responses from the backend.
        errorMsg = typeof body.error === "string" ? body.error : (body.error.message ?? errorMsg);
      }
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
};

export const api = {
  authUrl: `${API_BASE_URL}/auth/lichess`,
  getMe: async () => request<{ user: User }>("/auth/me"),
  listTournaments: async () => request<{ tournaments: Tournament[] }>("/tournaments"),
  getGlobalLeaderboard: async () => request<{ leaderboard: import("./types").GlobalLeaderboardEntry[] }>("/leaderboard"),
  getTournamentLive: async (id: string) => request<TournamentLivePayload>(`/tournaments/${id}`),
  getTournamentStandings: async (id: string) => request<{ standings: Standing[] }>(`/tournaments/${id}/standings`),
  registerForTournament: async (id: string) =>
    request<{ participant: unknown }>(`/tournaments/${id}/join`, {
      method: "POST"
    }),
  checkInTournament: async (id: string) =>
    request<{ success: boolean; standings: Standing[] }>(`/tournaments/${id}/checkin`, {
      method: "POST"
    }),
  startTournament: async (id: string) =>
    request<{ matches: unknown }>(`/tournaments/${id}/start`, {
      method: "POST"
    }),
  stopTournament: async (id: string) =>
    request<{ success: boolean }>(`/tournaments/${id}/stop`, {
      method: "POST"
    }),
  leaveFromTournament: async (id: string) =>
    request<{ success: boolean }>(`/tournaments/${id}/leave`, {
      method: "POST"
    }),
  getUpcomingTournament: async () => request<{ tournament: Tournament | null }>(`/tournaments/upcoming`),
  pollLichessGames: async () =>
    request<{ checked: number; completed: number }>("/webhooks/lichess-game-end", {
      method: "POST"
    }),
  // Fire-and-forget ping to mark attendance before Lichess redirect.
  joinMatchCheck: async (matchId: string) =>
    request<{ ok: boolean }>(`/matches/${matchId}/join-check`, { method: "POST" }),

  // Admin endpoints
  seedTestPlayers: async (tournamentId: string) =>
    request<{ seeded: string[]; message: string }>(
      `/admin/tournaments/${tournamentId}/seed-test-players`,
      { method: "POST" }
    ),
  fastForwardRound: async (tournamentId: string) =>
    request<{ message: string }>(
      `/admin/tournaments/${tournamentId}/fast-forward`,
      { method: "POST" }
    ),
  retryLichessGames: async (tournamentId: string) =>
    request<{ message: string }>(
      `/admin/tournaments/${tournamentId}/retry-lichess`,
      { method: "POST" }
    ),

  // User profile endpoints
  getUserProfile: async (username: string) =>
    request<UserProfile>(`/users/${username}`),
  updateBio: async (bio: string) =>
    request<{ user: { id: string; lichessUsername: string; bio: string | null } }>(
      "/users/profile/bio",
      { method: "PUT", body: JSON.stringify({ bio }) }
    ),
  getChat: async (tournamentId: string) => request<{ messages: Array<{ id: string; username: string; message: string; timestamp: number }> }>(`/chat?tournamentId=${tournamentId}`),
  sendChat: async (tournamentId: string, message: string) => request<{ messages: Array<{ id: string; username: string; message: string; timestamp: number }> }>("/chat", { method: "POST", body: JSON.stringify({ tournamentId, message }) }),
  logout: async () => request<{ ok: boolean }>("/auth/logout", { method: "POST" })
};
