-- CreateEnum
CREATE TYPE "TournamentType" AS ENUM ('BULLET', 'BLITZ', 'RAPID');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "MatchResult" AS ENUM ('PENDING', 'WHITE_WIN', 'BLACK_WIN', 'DRAW', 'FORFEIT');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'PLAYING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'ELIMINATED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "lichessUsername" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "bulletRating" INTEGER,
    "blitzRating" INTEGER,
    "rapidRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TournamentType" NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'UPCOMING',
    "currentRound" INTEGER NOT NULL DEFAULT 0,
    "registrationClosesAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "winnerId" UUID,

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentParticipant" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lives" INTEGER NOT NULL DEFAULT 3,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
    "hasReceivedBye" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TournamentParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentBye" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TournamentBye_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" UUID NOT NULL,
    "tournamentId" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "whitePlayerId" UUID NOT NULL,
    "blackPlayerId" UUID NOT NULL,
    "lichessGameId" TEXT,
    "lichessChallengeUrl" TEXT,
    "lichessWhiteUrl" TEXT,
    "lichessBlackUrl" TEXT,
    "forfeitedPlayerId" UUID,
    "result" "MatchResult" NOT NULL DEFAULT 'PENDING',
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_lichessUsername_key" ON "User"("lichessUsername");

-- CreateIndex
CREATE INDEX "User_lichessUsername_idx" ON "User"("lichessUsername");

-- CreateIndex
CREATE INDEX "Tournament_type_status_idx" ON "Tournament"("type", "status");

-- CreateIndex
CREATE INDEX "TournamentParticipant_tournamentId_status_lives_idx" ON "TournamentParticipant"("tournamentId", "status", "lives");

-- CreateIndex
CREATE INDEX "TournamentParticipant_userId_idx" ON "TournamentParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentParticipant_tournamentId_userId_key" ON "TournamentParticipant"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "TournamentBye_userId_idx" ON "TournamentBye"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentBye_tournamentId_userId_key" ON "TournamentBye"("tournamentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentBye_tournamentId_round_key" ON "TournamentBye"("tournamentId", "round");

-- CreateIndex
CREATE INDEX "Match_tournamentId_round_idx" ON "Match"("tournamentId", "round");

-- CreateIndex
CREATE INDEX "Match_whitePlayerId_idx" ON "Match"("whitePlayerId");

-- CreateIndex
CREATE INDEX "Match_blackPlayerId_idx" ON "Match"("blackPlayerId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_tournamentId_round_whitePlayerId_blackPlayerId_key" ON "Match"("tournamentId", "round", "whitePlayerId", "blackPlayerId");

-- AddForeignKey
ALTER TABLE "Tournament" ADD CONSTRAINT "Tournament_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentParticipant" ADD CONSTRAINT "TournamentParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentBye" ADD CONSTRAINT "TournamentBye_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentBye" ADD CONSTRAINT "TournamentBye_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_whitePlayerId_fkey" FOREIGN KEY ("whitePlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_blackPlayerId_fkey" FOREIGN KEY ("blackPlayerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
