export type Rating = "unknown" | "unsure" | "known";
export type Round = {
  ids: string[];
  directions: Record<string, "en_cz" | "cz_en">;
  index: number;
  answers: Partial<Record<string, Rating>>;
  flipped: boolean;
  done: boolean;
};

export function rateRound(round: Round | null, rating: Rating): Round | null {
  if (!round || !round.flipped || round.done || !round.ids[round.index]) return round;
  const answers = { ...round.answers, [round.ids[round.index]]: rating };
  return round.index + 1 === round.ids.length
    ? { ...round, answers, done: true }
    : { ...round, answers, index: round.index + 1, flipped: false };
}

export function roundCounts(round: Round | null) {
  const counts = { unknown: 0, unsure: 0, known: 0 };
  for (const rating of Object.values(round?.answers ?? {})) if (rating) counts[rating]++;
  return counts;
}

export function retryIds(round: Round) {
  return round.ids.filter(id => round.answers[id] === "unknown" || round.answers[id] === "unsure");
}

export function swipeRating(dx: number, dy: number): Rating | null {
  if (Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.2) return dx > 0 ? "known" : "unknown";
  if (dy <= -64 && Math.abs(dy) > Math.abs(dx) * 1.2) return "unsure";
  return null;
}
