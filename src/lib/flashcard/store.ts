import { nanoid } from "nanoid";

import type { Card, Deck, DeckPatch, DeckPreferences } from "./types";
import { DEFAULT_DECK_PREFERENCES } from "./types";
import * as db from "./db";

export { QuotaExceededError } from "./db";
export const deleteOldestDeck = db.deleteOldestDeck;

const sessionCache = new Map<string, Deck>();

function createDeckId(): string {
  return nanoid(12);
}

export function createDeck(params: {
  name?: string;
  subject?: string;
  description?: string;
  preferences?: DeckPreferences;
  cards?: Card[];
}): Deck {
  const now = Date.now();
  const deck: Deck = {
    id: createDeckId(),
    name: params.name?.trim() || "Untitled deck",
    subject: params.subject?.trim() || undefined,
    description: params.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    cards: params.cards ?? [],
    reviewState: {
      sessionsCompleted: 0,
      lastReviewedAt: null,
      currentStreakDays: 0,
    },
    preferences: params.preferences ?? DEFAULT_DECK_PREFERENCES,
    _schemaVersion: 1,
  };
  sessionCache.set(deck.id, deck);
  return deck;
}

export async function saveDeck(deck: Deck): Promise<void> {
  sessionCache.set(deck.id, deck);
  await db.saveDeck(deck);
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const cached = sessionCache.get(id);
  if (cached) return cached;

  const persisted = await db.getDeck(id);
  if (!persisted) return undefined;

  sessionCache.set(id, persisted);
  return persisted;
}

export async function updateDeck(
  id: string,
  patch: DeckPatch,
): Promise<Deck | undefined> {
  const existing = sessionCache.get(id) ?? (await db.getDeck(id));
  if (!existing) return undefined;

  const updated: Deck = { ...existing, ...patch, updatedAt: Date.now() };
  sessionCache.set(id, updated);
  await db.saveDeck(updated);
  return updated;
}

export async function deleteDeck(id: string): Promise<boolean> {
  const cached = sessionCache.get(id);
  sessionCache.delete(id);
  if (cached || (await db.getDeck(id))) {
    await db.deleteDeck(id);
    return true;
  }
  return false;
}

export async function listDecks(): Promise<Deck[]> {
  return db.listDecks();
}

export async function appendCardsToDeck(
  id: string,
  cards: Card[],
): Promise<Deck | undefined> {
  const existing = sessionCache.get(id) ?? (await db.getDeck(id));
  if (!existing) return undefined;

  const updated: Deck = {
    ...existing,
    cards: [...existing.cards, ...cards],
    updatedAt: Date.now(),
  };
  sessionCache.set(id, updated);
  await db.saveDeck(updated);
  return updated;
}

export async function updateCardInDeck(
  deckId: string,
  cardId: string,
  patch: Partial<Card>,
): Promise<Deck | undefined> {
  const existing = sessionCache.get(deckId) ?? (await db.getDeck(deckId));
  if (!existing) return undefined;

  const updated: Deck = {
    ...existing,
    cards: existing.cards.map((c) =>
      c.id === cardId ? { ...c, ...patch, updatedAt: Date.now() } : c,
    ),
    updatedAt: Date.now(),
  };
  sessionCache.set(deckId, updated);
  await db.saveDeck(updated);
  return updated;
}

export async function deleteCardFromDeck(
  deckId: string,
  cardId: string,
): Promise<Deck | undefined> {
  const existing = sessionCache.get(deckId) ?? (await db.getDeck(deckId));
  if (!existing) return undefined;

  const updated: Deck = {
    ...existing,
    cards: existing.cards.filter((c) => c.id !== cardId),
    updatedAt: Date.now(),
  };
  sessionCache.set(deckId, updated);
  await db.saveDeck(updated);
  return updated;
}
