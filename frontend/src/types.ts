type TournamentType = "BULLET" | "BLITZ" | "RAPID";
type TournamentStatus = "UPCOMING" | "ACTIVE" | "FINISHED";
type MatchStatus = "SCHEDULED" | "PLAYING" | "COMPLETED";
type MatchResult = "PENDING" | "WHITE_WIN" | "BLACK_WIN" | "DRAW" | "FORFEIT";
type ParticipantStatus = "ACTIVE" | "ELIMINATED" | "WINNER";

export interface User {
  id: string;
  lichessUsername: string;
  rating: number;
  blitzRating?: number | null;
  isAdmin?: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  type: TournamentType;
  status: TournamentStatus;
  currentRound: number;
  createdAt: string;
  roundStartedAt?: string | null;
  registrationClosesAt?: string | null;
  winner?: User | null;
  _count?: {
    participants: number;
    matches: number;
  };
}

export interface TournamentMatch {
  id: string;
  round: number;
  whitePlayer: User;
  blackPlayer: User;
  status: MatchStatus;
  result: MatchResult;
  lichessGameId?: string | null;
  lichessChallengeUrl?: string | null;
  lichessWhiteUrl?: string | null;
  lichessBlackUrl?: string | null;
  whiteJoined?: boolean;
  blackJoined?: boolean;
}

export interface Standing {
  id: string;
  userId: string;
  user: User;
  lives: number;
  points: number;
  status: ParticipantStatus;
  hasReceivedBye: boolean;
  checkedIn: boolean;
  stats?: {
    wins: number;
    losses: number;
    draws: number;
    livesTaken: number;
  };
}

export interface TournamentLivePayload {
  tournament: Tournament;
  matches: TournamentMatch[];
  standings: Standing[];
}

interface RecentMatch {
  date: string;
  round: number;
  opponent: string;
  outcome: string;
}

export interface UserProfile {
  user: {
    id: string;
    lichessUsername: string;
    rating: number;
    blitzRating: number | null;
    bio: string | null;
    createdAt: string;
  };
  stats: {
    tournamentsPlayed: number;
    survived: number;
    eliminated: number;
    avgEliminationRound: number | null;
    wins: number;
    losses: number;
    draws: number;
    forfeitWins: number;
    forfeitLosses: number;
    strikesTaken: number;
    strikesLost: number;
  };
  recentMatches: RecentMatch[];
}

export interface GlobalLeaderboardEntry {
  rank: number;
  user: {
    id: string;
    lichessUsername: string;
    rating: number;
    blitzRating: number | null;
  };
  stats: {
    wins: number;
    losses: number;
    draws: number;
    totalGames: number;
    winPercentage: number;
  };
}
