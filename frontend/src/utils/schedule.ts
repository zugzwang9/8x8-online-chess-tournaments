import type { Tournament } from "../types";

export interface ScheduledTournament {
  key: string;
  date: Date;
  label: string;
  tournament?: Tournament;
}

const formatScheduleDate = (date: Date): string =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short"
  })
    .format(date)
    .replace(" at ", " - ");

// Returns the nearest upcoming Sunday at 17:00 UTC (= tournament start time).
// Uses UTC arithmetic throughout so the result is identical for every player
// regardless of their browser timezone.
const nextSundayAt1700UTC = (): Date => {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday
  const daysUntilSunday = (7 - day) % 7;
  // Build the date in UTC to avoid local-clock offsets
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  date.setUTCHours(17, 0, 0, 0);

  // Keep today's Sunday slot visible until the end of the UTC day so the
  // running tournament is still shown in the schedule bar after it starts.
  const cutoff = new Date(date);
  cutoff.setUTCHours(23, 59, 59, 999);
  if (cutoff.getTime() <= now.getTime()) {
    date.setUTCDate(date.getUTCDate() + 7);
  }

  return date;
};

export const generateNineWeekSchedule = (tournaments: Tournament[]): ScheduledTournament[] => {
  // Generate the next 9 Sunday slots at 17:00 UTC
  const sundays = Array.from({ length: 9 }, (_, i) => {
    const d = nextSundayAt1700UTC(); // nearest upcoming Sunday at 17:00 UTC
    d.setUTCDate(d.getUTCDate() + i * 7);
    return d;
  });
  return sundays.map((date) => {
    // Match a tournament to this slot if its registrationClosesAt is within 60 minutes.
    // Since the provisioner sets registrationClosesAt to exactly 17:00 UTC, the diff
    // will typically be 0 — the window handles manual or slightly-off-schedule tournaments.
    const tournament = tournaments.find((t) => {
      if (!t.registrationClosesAt) return false;
      const reg = new Date(t.registrationClosesAt);
      return Math.abs(reg.getTime() - date.getTime()) < 60 * 60 * 1000;
    });
    return {
      key: tournament?.id ?? `scheduled-${date.toISOString()}`,
      date,
      label: formatScheduleDate(date),
      tournament
    };
  });
};

export const findActiveTournament = (tournaments: Tournament[]): Tournament | undefined =>
  tournaments.find((tournament) => tournament.status === "ACTIVE");
