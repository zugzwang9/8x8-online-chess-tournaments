-- AlterEnum
ALTER TYPE "ParticipantStatus" ADD VALUE 'WINNER';

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "blackJoined" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whiteJoined" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tournament" ADD COLUMN     "maxRounds" INTEGER NOT NULL DEFAULT 11,
ADD COLUMN     "roundStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TournamentParticipant" ADD COLUMN     "checkedIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consecutiveForfeits" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "lives" SET DEFAULT 3,
ALTER COLUMN "lives" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lichessAccessToken" TEXT;
