import dotenv from "dotenv";

dotenv.config();

const requiredEnv = ["DATABASE_URL", "JWT_SECRET", "LICHESS_CLIENT_ID", "LICHESS_REDIRECT_URI"] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET as string,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  lichessClientId: process.env.LICHESS_CLIENT_ID as string,
  lichessRedirectUri: process.env.LICHESS_REDIRECT_URI as string,
  lichessApiToken: process.env.LICHESS_API_TOKEN,
  lichessRatedChallenges: process.env.LICHESS_RATED_CHALLENGES === "true"
};
