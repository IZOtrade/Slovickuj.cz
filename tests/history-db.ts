import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { loadDeckHistory, writeReviewTransaction, type ReviewInput } from "../src/lib/practice-store";
import { historyCounts, recommendedIds } from "../src/lib/practice-history";

class VerificationRollback extends Error {}

async function verify() {
  if (!process.env.DATABASE_URL) {
    console.log("History DB verification skipped: no database configured locally.");
    return;
  }
  const userId = randomUUID();
  try {
    await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: { id: userId, name: "History verification" } });
      const stranger = await tx.user.create({ data: { name: "History isolation verification" } });
      const deck = await tx.deck.create({ data: { title: "History verification", ownerId: user.id } });
      const words = await tx.word.createManyAndReturn({ data: ["one", "two", "three"].map(en => ({ en, cz: en, deckId: deck.id })) });
      const sessionId = randomUUID();
      const input: ReviewInput = { eventId: randomUUID(), sessionId, wordId: words[0].id, deckId: deck.id, totalWords: 3, mode: "mix", direction: "en_cz", rating: "known" };
      await assert.rejects(() => writeReviewTransaction(tx, stranger.id, input), /přístup/);
      assert.equal(await writeReviewTransaction(tx, user.id, input), "known");
      assert.equal(await writeReviewTransaction(tx, user.id, input), "known");
      assert.equal(await writeReviewTransaction(tx, user.id, { ...input, eventId: randomUUID(), rating: "unknown" }), "known");
      let history = await loadDeckHistory(deck.id, user.id, tx);
      assert.equal(history.totalReviews, 1, "replays must not count twice");
      assert.equal(history.sessions[0].finishedAt, null, "partial rounds must remain visible");
      assert.equal(history.progress[words[0].id].reviewCount, 1);
      for (const [index, rating] of [[1, "unsure"], [2, "unknown"]] as const) {
        await writeReviewTransaction(tx, user.id, { ...input, eventId: randomUUID(), wordId: words[index].id, rating });
      }
      history = await loadDeckHistory(deck.id, user.id, tx);
      assert.equal(history.totalReviews, 3);
      assert.ok(history.sessions[0].finishedAt, "all three answers must complete the round");
      assert.deepEqual(historyCounts(words.map(word => word.id), history), { known: 1, unsure: 1, unknown: 1, fresh: 0, due: 2 });
      assert.equal(recommendedIds(words.map(word => word.id), history).length, 2);
      const strangerHistory = await loadDeckHistory(deck.id, stranger.id, tx);
      assert.equal(strangerHistory.totalReviews, 0, "another account must not read history");
      assert.deepEqual(strangerHistory.progress, {});
      const previousDue = history.progress[words[0].id].nextReviewAt;
      await writeReviewTransaction(tx, user.id, { ...input, eventId: randomUUID(), sessionId: randomUUID(), totalWords: 1 });
      history = await loadDeckHistory(deck.id, user.id, tx);
      assert.equal(history.totalReviews, 4, "known words must still be available in a new round");
      assert.equal(history.totalSessions, 2);
      assert.equal(history.progress[words[0].id].nextReviewAt, previousDue, "early practice must preserve due date");
      await tx.word.delete({ where: { id: words[0].id } });
      history = await loadDeckHistory(deck.id, user.id, tx);
      assert.equal(history.totalReviews, 4, "deleting a word must preserve historical totals");
      assert.equal(history.progress[words[0].id], undefined);
      // Fixtures and every write above are uncommitted and disappear together.
      throw new VerificationRollback();
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 30000 });
  } catch (error) {
    if (!(error instanceof VerificationRollback)) throw error;
  }
  assert.equal(await prisma.user.findUnique({ where: { id: userId } }), null, "verification must leave no fixtures");
  console.log("History DB verification passed: persistence, idempotency, account isolation, completed/partial rounds, repeat-known and rollback cleanup.");
}

verify().catch(error => {
  console.error("History DB verification failed:", error instanceof Error ? error.name : "unknown error");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
