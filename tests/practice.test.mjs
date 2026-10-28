import test from "node:test";
import assert from "node:assert/strict";
import { rateRound, roundCounts, retryIds, swipeRating } from "../src/lib/practice.ts";

const initial = () => ({ ids: ["a", "b", "c"], directions: { a: "en_cz", b: "cz_en", c: "en_cz" }, index: 0, answers: {}, flipped: false, done: false });

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
