"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function ownerId() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Přihlášení vypršelo. Přihlaste se znovu.");
  return session.user.id;
}

const wordFields = z.object({ en: z.string().trim().min(1).max(240), cz: z.string().trim().min(1).max(240), category: z.string().trim().max(100).optional() });

export async function createDeck(input: { title: string; description?: string }) {
  const userId = await ownerId();
  const title = z.string().trim().min(1).max(100).parse(input.title);
  const description = input.description?.trim().slice(0, 500) || null;
  const deck = await prisma.deck.create({ data: { title, description, ownerId: userId } });
  revalidatePath("/");
  return { id: deck.id, title: deck.title, description: deck.description, words: [] };
}

export async function deleteDeck(deckId: string) {
  const userId = await ownerId();
  await prisma.deck.deleteMany({ where: { id: deckId, ownerId: userId } });
  revalidatePath("/");
}

export async function createWord(deckId: string, input: { en: string; cz: string; category?: string }) {
  const userId = await ownerId();
  const fields = wordFields.parse(input);
  const deck = await prisma.deck.findFirst({ where: { id: deckId, ownerId: userId }, select: { id: true } });
  if (!deck) throw new Error("Balíček nebyl nalezen.");
  const word = await prisma.word.create({ data: { ...fields, deckId } });
  revalidatePath("/");
  return word;
}

export async function updateWord(wordId: string, input: { en: string; cz: string; category?: string }) {
  const userId = await ownerId();
  const fields = wordFields.parse(input);
  const owned = await prisma.word.findFirst({ where: { id: wordId, deck: { ownerId: userId } }, select: { id: true } });
  if (!owned) throw new Error("Slovíčko nebylo nalezeno.");
  const word = await prisma.word.update({ where: { id: wordId }, data: fields });
  revalidatePath("/");
  return word;
}

export async function deleteWord(wordId: string) {
  const userId = await ownerId();
  await prisma.word.deleteMany({ where: { id: wordId, deck: { ownerId: userId } } });
  revalidatePath("/");
}

export async function bulkImport(deckId: string, input: Array<{ en: string; cz: string; category?: string }>) {
  const userId = await ownerId();
  const deck = await prisma.deck.findFirst({ where: { id: deckId, ownerId: userId }, select: { id: true } });
  if (!deck) throw new Error("Balíček nebyl nalezen.");
  const rows = z.array(wordFields).max(1000).parse(input).filter((row) => row.en && row.cz);
  if (rows.length) await prisma.word.createMany({ data: rows.map((row) => ({ ...row, deckId })) });
  revalidatePath("/");
  return rows.length;
}

export async function updateSettings(input: { mode: string; autoPlay: boolean; speechRate: number }) {
  const userId = await ownerId();
  const settings = z.object({ mode: z.enum(["mix", "en_cz", "cz_en"]), autoPlay: z.boolean(), speechRate: z.number().min(0.8).max(1.1) }).parse(input);
  await prisma.userSettings.upsert({ where: { userId }, update: settings, create: { userId, ...settings } });
  revalidatePath("/");
}
