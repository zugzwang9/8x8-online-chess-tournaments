# 8x8

## What is 8x8?
8x8 is a weekly online chess tournament held every Sunday at 17:00 UTC. Players compete in a Gladiator-style elimination format - enter with 3 lives, fight to keep them. The tournament runs for up to 11 rounds, and anyone still standing at the end wins the arena.

## The Gladiator Format
Every player starts each tournament with 3 lives (strikes).

- **Win** - your opponent loses a life. You gain a point.
- **Draw** - both players lose half a life. Both gain 0.5 points.
- **Lose** - you lose a life. Your opponent gains a point.
- **No-show** - the absent player loses a life. The present player gets a walk-over point.

Lose all 3 lives and you are eliminated. The players who survive all 11 rounds are the winners.

## How it Works
8x8 is built on top of [Lichess](https://lichess.org), the free and open-source chess platform. You sign in with your Lichess account, register for the upcoming Sunday tournament, and when the event starts your matches are automatically created on Lichess. Each round lasts up to 15 minutes, if a match isn't completed in time, it is resolved by attendance: who showed up and who didn't.

## Tournament Specs

| Feature | Details |
| --- | --- |
| **Schedule** | Every Sunday at 17:00 UTC |
| **Time control** | 5+0 Blitz |
| **Format** | Gladiator - 3 lives |
| **Rounds** | Up to 11 |
| **Pairing** | Matched by lives remaining |
| **Platform** | Lichess (free account required) |

## Tech Stack
- **Backend:** Node.js, Express, Prisma ORM, PostgreSQL (Neon)
- **Frontend:** React, TypeScript, Tailwind CSS, Vite
- **Integrations:** Lichess OAuth & Lichess Board API

### 4. Running the App
You will need to run both the backend and frontend development servers.

Terminal 1 (Backend):
```bash
npm run dev
```

Terminal 2 (Frontend):
```bash
npm run frontend:dev
```

The frontend will be available at `http://localhost:5176` and the API at `http://localhost:4000`.
