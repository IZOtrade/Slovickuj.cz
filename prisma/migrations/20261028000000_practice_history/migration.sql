CREATE TABLE "WordProgress" (
    "wordId" TEXT NOT NULL,
    "lastRating" TEXT NOT NULL,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "knownCount" INTEGER NOT NULL DEFAULT 0,
    "unsureCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "knownStreak" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL,
    "nextReviewAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WordProgress_pkey" PRIMARY KEY ("wordId")
);
CREATE TABLE "PracticeRound" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "totalWords" INTEGER NOT NULL,
    "reviewedCount" INTEGER NOT NULL DEFAULT 0,
    "knownCount" INTEGER NOT NULL DEFAULT 0,
    "unsureCount" INTEGER NOT NULL DEFAULT 0,
    "unknownCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "PracticeRound_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PracticeReview" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "wordId" TEXT,
    "rating" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeReview_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PracticeRound_deckId_lastReviewedAt_idx" ON "PracticeRound"("deckId", "lastReviewedAt");
CREATE UNIQUE INDEX "PracticeReview_roundId_wordId_key" ON "PracticeReview"("roundId", "wordId");
CREATE INDEX "PracticeReview_wordId_createdAt_idx" ON "PracticeReview"("wordId", "createdAt");
ALTER TABLE "WordProgress" ADD CONSTRAINT "WordProgress_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeRound" ADD CONSTRAINT "PracticeRound_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeReview" ADD CONSTRAINT "PracticeReview_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "PracticeRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeReview" ADD CONSTRAINT "PracticeReview_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "Word"("id") ON DELETE SET NULL ON UPDATE CASCADE;
