import test from "node:test";
import assert from "node:assert/strict";
import { rateRound, roundCounts, retryIds, swipeRating } from "../src/lib/practice.ts";
import { emptyHistory, historyCounts, recommendedIds, reviewSchedule } from "../src/lib/practice-history.ts";

const initial = () => ({ sessionId: "test-round", mode: "mix", ids: ["a", "b", "c"], directions: { a: "en_cz", b: "cz_en", c: "en_cz" }, index: 0, answers: {}, flipped: false, done: false });

test("requires revealing the translation and prevents duplicate grading", () => {
  let round = initial();
  assert.equal(rateRound(round, "known"), round);
  round = rateRound({ ...round, flipped: true }, "unknown");
  assert.equal(round.index, 1);
  assert.equal(round.flipped, false);
  assert.equal(rateRound(round, "known"), round);
  assert.deepEqual(roundCounts(round), { unknown: 1, unsure: 0, known: 0 });
});

test("tracks all three ratings and repeats only unknown or unsure words", () => {
  let round = initial();
  for (const rating of ["unknown", "unsure", "known"]) round = rateRound({ ...round, flipped: true }, rating);
  assert.equal(round.done, true);
  assert.deepEqual(roundCounts(round), { unknown: 1, unsure: 1, known: 1 });
  assert.deepEqual(retryIds(round), ["a", "b"]);
  assert.equal(rateRound(round, "unknown"), round);
});

test("handles an all-known round, a single word and an empty round", () => {
  let round = { ...initial(), ids: ["a"], flipped: true };
  round = rateRound(round, "known");
  assert.equal(round.done, true);
  assert.deepEqual(retryIds(round), []);
  assert.equal(roundCounts(round).known, 1);
  const empty = { ...initial(), ids: [], flipped: true };
  assert.equal(rateRound(empty, "known"), empty);
  assert.equal(rateRound(null, "known"), null);
});

test("recognizes intentional swipes and ignores taps, downward and ambiguous drags", () => {
  assert.equal(swipeRating(-100, 10), "unknown");
  assert.equal(swipeRating(100, -10), "known");
  assert.equal(swipeRating(5, -100), "unsure");
  for (const [dx, dy] of [[5, 3], [63, 0], [0, 100], [100, 100], [70, -65]]) assert.equal(swipeRating(dx, dy), null);
});

test("known words return when due while the full deck always remains available", () => {
  const now = Date.parse("2026-10-28T12:00:00Z");
  const ids = ["new", "known", "due", "unsure", "unknown"];
  const history = emptyHistory();
  for (const [id, lastRating, offset] of [["known", "known", 86400000], ["due", "known", -1], ["unsure", "unsure", 86400000], ["unknown", "unknown", 600000]]) {
    history.progress[id] = { wordId: id, lastRating, nextReviewAt: new Date(now + offset).toISOString() };
  }
  assert.deepEqual(recommendedIds(ids, history, now), ["new", "due", "unsure", "unknown"]);
  assert.deepEqual(historyCounts(ids, history, now), { known: 2, unsure: 1, unknown: 1, fresh: 1, due: 4 });
  assert.equal(recommendedIds(ids, history, now + 86400001).length, 5);
  assert.equal(ids.length, 5);
});

test("uses latest status once per word and ignores progress for deleted words", () => {
  const history = emptyHistory();
  history.progress.a = { lastRating: "known", nextReviewAt: "2099-01-01T00:00:00Z", reviewCount: 50 };
  history.progress.deleted = { lastRating: "unknown", reviewCount: 10 };
  assert.deepEqual(historyCounts(["a", "b"], history, 0), { known: 1, unsure: 0, unknown: 0, fresh: 1, due: 1 });
});

test("schedules graded intervals, caps them and resets after uncertainty", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  assert.equal(reviewSchedule("known", 0, now).nextReviewAt - now, 86400000);
  assert.equal(reviewSchedule("known", 1, now).nextReviewAt - now, 3 * 86400000);
  assert.equal(reviewSchedule("known", 100, now).nextReviewAt - now, 60 * 86400000);
  assert.equal(reviewSchedule("unsure", 5, now).knownStreak, 0);
  assert.equal(reviewSchedule("unknown", 5, now).nextReviewAt - now, 600000);
});

test("early practice does not push the recommended date farther away", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const due = new Date("2026-10-29T12:00:00Z");
  assert.deepEqual(reviewSchedule("known", 1, now, due), { knownStreak: 1, nextReviewAt: due });
  assert.equal(reviewSchedule("known", 1, due, due).knownStreak, 2);
});
