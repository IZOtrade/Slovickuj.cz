import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { reviewSchedule, type DeckHistory } from "@/lib/practice-history";
import type { Rating } from "@/lib/practice";

export async function loadDeckHistory(deckId: string, userId: string, db: Pick<PrismaClient, "practiceRound" | "wordProgress"> = prisma): Promise<DeckHistory> {
  const where = { deckId, deck: { ownerId: userId } };
  const [totals, sessions, progress] = await Promise.all([
    db.practiceRound.aggregate({ where, _sum: { reviewedCount: true, knownCount: true, unsureCount: true, unknownCount: true }, _count: true }),
    db.practiceRound.findMany({ where, orderBy: { lastReviewedAt: "desc" }, take: 8 }),
    db.wordProgress.findMany({ where: { word: { deckId, deck: { ownerId: userId } } } }),
  ]);
  return {
    totalReviews: totals._sum.reviewedCount ?? 0,
    totalSessions: totals._count,
    knownReviews: totals._sum.knownCount ?? 0,
    unsureReviews: totals._sum.unsureCount ?? 0,
    unknownReviews: totals._sum.unknownCount ?? 0,
    sessions: sessions.map(item => ({ ...item, startedAt: item.startedAt.toISOString(), lastReviewedAt: item.lastReviewedAt.toISOString(), finishedAt: item.finishedAt?.toISOString() ?? null })),
    progress: Object.fromEntries(progress.map(item => [item.wordId, { ...item, lastRating: item.lastRating as Rating, lastReviewedAt: item.lastReviewedAt.toISOString(), nextReviewAt: item.nextReviewAt.toISOString() }])),
  };
}

export type ReviewInput = {
  eventId: string; sessionId: string; wordId: string; deckId: string; totalWords: number;
  mode: "mix" | "en_cz" | "cz_en"; direction: "en_cz" | "cz_en"; rating: Rating;
};

export async function storeReview(userId: string, input: ReviewInput) {
  let accepted: Rating | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      accepted = await prisma.$transaction(async tx => {
        return writeReviewTransaction(tx, userId, input);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
      break;
    } catch (error) {
      // A concurrent request may win either the event or round key. Read its committed result on retry.
      if (attempt < 2 && error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) continue;
      throw error;
    }
  }
  if (!accepted) throw new Error("Hodnocení se nepodařilo uložit. Zkus to znovu.");
  return { rating: accepted, history: await loadDeckHistory(input.deckId, userId) };
}

export async function writeReviewTransaction(tx: Prisma.TransactionClient, userId: string, input: ReviewInput): Promise<Rating> {
  // Every write, including a replayed request, must belong to the signed-in owner.
  const word = await tx.word.findFirst({ where: { id: input.wordId, deckId: input.deckId, deck: { ownerId: userId } }, include: { progress: true } });
  if (!word) throw new Error("Slovíčko nebylo nalezeno nebo k němu nemáš přístup.");
  const duplicate = await tx.practiceReview.findUnique({ where: { id: input.eventId } })
    ?? await tx.practiceReview.findUnique({ where: { roundId_wordId: { roundId: input.sessionId, wordId: word.id } } });
  if (duplicate) {
    if (duplicate.wordId !== word.id || duplicate.roundId !== input.sessionId) throw new Error("Toto hodnocení nelze uložit.");
    return duplicate.rating as Rating;
  }
  const session = await tx.practiceRound.upsert({
    where: { id: input.sessionId }, update: {},
    create: { id: input.sessionId, deckId: word.deckId, mode: input.mode, totalWords: input.totalWords },
  });
  if (session.deckId !== word.deckId || session.mode !== input.mode || session.totalWords !== input.totalWords || session.finishedAt) throw new Error("Kolo se změnilo. Spusť nové procvičování.");
  if (session.mode !== "mix" && session.mode !== input.direction) throw new Error("Směr procvičování neodpovídá kolu.");
  const now = new Date();
  const schedule = reviewSchedule(input.rating, word.progress?.knownStreak ?? 0, now, word.progress?.nextReviewAt);
  const knownCount = input.rating === "known" ? 1 : 0;
  const unsureCount = input.rating === "unsure" ? 1 : 0;
  const unknownCount = input.rating === "unknown" ? 1 : 0;
  await tx.practiceReview.create({ data: { id: input.eventId, roundId: session.id, wordId: word.id, rating: input.rating, direction: input.direction, createdAt: now } });
  await tx.wordProgress.upsert({
    where: { wordId: word.id },
    create: { wordId: word.id, lastRating: input.rating, reviewCount: 1, knownCount, unsureCount, unknownCount, lastReviewedAt: now, ...schedule },
    update: { lastRating: input.rating, reviewCount: { increment: 1 }, knownCount: { increment: knownCount }, unsureCount: { increment: unsureCount }, unknownCount: { increment: unknownCount }, lastReviewedAt: now, ...schedule },
  });
  await tx.practiceRound.update({ where: { id: session.id }, data: {
    reviewedCount: { increment: 1 }, knownCount: { increment: knownCount }, unsureCount: { increment: unsureCount }, unknownCount: { increment: unknownCount },
    lastReviewedAt: now, finishedAt: session.reviewedCount + 1 >= session.totalWords ? now : null,
  } });
  return input.rating;
}
