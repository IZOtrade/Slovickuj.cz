import type { Rating } from "./practice";

export type Progress = {
  wordId: string; lastRating: Rating; reviewCount: number; knownCount: number; unsureCount: number; unknownCount: number;
  knownStreak: number; lastReviewedAt: string; nextReviewAt: string;
};
export type SessionSummary = {
  id: string; mode: string; totalWords: number; reviewedCount: number; knownCount: number; unsureCount: number; unknownCount: number;
  startedAt: string; lastReviewedAt: string; finishedAt: string | null;
};
export type DeckHistory = {
  totalReviews: number; totalSessions: number; progress: Record<string, Progress>; sessions: SessionSummary[];
};
export const emptyHistory = (): DeckHistory => ({ totalReviews: 0, totalSessions: 0, progress: {}, sessions: [] });

// Known words remain available. Their recommended interval grows only after another successful review.
export function reviewSchedule(rating: Rating, previousStreak: number, now: Date, previousDue?: Date) {
  if (rating === "known" && previousStreak > 0 && previousDue && previousDue > now) {
    return { knownStreak: previousStreak, nextReviewAt: previousDue };
  }
  const knownStreak = rating === "known" ? previousStreak + 1 : 0;
  const days = [1, 3, 7, 14, 30, 60];
  const delay = rating === "unknown" ? 10 * 60_000 : rating === "unsure" ? 86_400_000 : days[Math.min(knownStreak - 1, days.length - 1)] * 86_400_000;
  return { knownStreak, nextReviewAt: new Date(now.getTime() + delay) };
}

export function historyCounts(ids: string[], history: DeckHistory, now = Date.now()) {
  const counts = { known: 0, unsure: 0, unknown: 0, fresh: 0, due: 0 };
  for (const id of ids) {
    const item = history.progress[id];
    if (!item) { counts.fresh++; counts.due++; continue; }
    counts[item.lastRating]++;
    if (item.lastRating !== "known" || Date.parse(item.nextReviewAt) <= now) counts.due++;
  }
  return counts;
}

export function recommendedIds(ids: string[], history: DeckHistory, now = Date.now()) {
  return ids.filter(id => !history.progress[id] || history.progress[id].lastRating !== "known" || Date.parse(history.progress[id].nextReviewAt) <= now);
}
