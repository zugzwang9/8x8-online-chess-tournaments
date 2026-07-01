import { prisma } from "../config/prisma";

const getNext9Sundays = (): Date[] => {
  const sundays: Date[] = [];
  const now = new Date();
  // Build the date entirely in UTC to avoid server hardware timezone offsets
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = date.getUTCDay(); // 0 is Sunday
  const daysUntilSunday = (7 - day) % 7;
  
  date.setUTCDate(date.getUTCDate() + daysUntilSunday);
  date.setUTCHours(17, 0, 0, 0);
  // If today is Sunday and it is past 17:00 UTC, start from next Sunday
  if (date.getTime() <= now.getTime()) {
    date.setUTCDate(date.getUTCDate() + 7);
  }
  for (let i = 0; i < 9; i++) {
    const d = new Date(date);
    d.setUTCDate(date.getUTCDate() + i * 7);
    sundays.push(d);
  }
  return sundays;
};

export const provisionUpcomingTournaments = async (): Promise<void> => {
  const sundays = getNext9Sundays();

  for (const sunday of sundays) {
    const minTime = new Date(sunday.getTime() - 30 * 60 * 1000);
    const maxTime = new Date(sunday.getTime() + 30 * 60 * 1000);

    const existing = await prisma.tournament.findFirst({
      where: {
        registrationClosesAt: {
          gte: minTime,
          lte: maxTime
        }
      }
    });

    if (!existing) {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const month = monthNames[sunday.getUTCMonth()];
      const day = sunday.getUTCDate();
      const name = `Sunday Gladiator — ${month} ${day}`;
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

      await prisma.tournament.create({
        data: {
          name,
          slug,
          type: "BLITZ",
          status: "UPCOMING",
          currentRound: 0,
          registrationClosesAt: sunday
        }
      });

      console.log(`[provisioner] Created tournament for Sunday ${month} ${day}`);
    }
  }
};
