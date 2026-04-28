import {
  CURRENT_SCHEMA_VERSION,
  QuotaExceededError,
  getDB,
  isQuotaError,
  type PersistedDeck,
} from "@/lib/db";

import type { Deck, DeckMediaBlob } from "./types";

export { QuotaExceededError };
export type { PersistedDeck };

const DECKS_STORE = "decks";
const MEDIA_STORE = "deckMedia";

function toPersisted(deck: Deck): PersistedDeck {
  return {
    id: deck.id,
    name: deck.name,
    subject: deck.subject,
    description: deck.description,
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    data: deck,
    _schemaVersion: CURRENT_SCHEMA_VERSION,
  };
}

function fromPersisted(p: PersistedDeck): Deck | null {
  const raw = p.data as Deck | undefined;
  if (!raw || typeof raw !== "object") return null;
  const rawPreferences = raw.preferences;
  return {
    id: p.id,
    name: p.name,
    subject: p.subject,
    description: p.description,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    cards: Array.isArray(raw.cards) ? raw.cards : [],
    reviewState: raw.reviewState ?? {
      sessionsCompleted: 0,
      lastReviewedAt: null,
      currentStreakDays: 0,
    },
    preferences: {
      styles: rawPreferences?.styles ?? [],
      difficulty: rawPreferences?.difficulty ?? "medium",
      styleAutoPick: rawPreferences?.styleAutoPick ?? true,
      generationInstructions:
        typeof rawPreferences?.generationInstructions === "string"
          ? rawPreferences.generationInstructions
          : "",
    },
    _schemaVersion: p._schemaVersion ?? CURRENT_SCHEMA_VERSION,
  };
}

export async function saveDeck(deck: Deck): Promise<void> {
  try {
    const db = await getDB();
    await db.put(DECKS_STORE, toPersisted(deck));
  } catch (err) {
    if (isQuotaError(err)) throw new QuotaExceededError();
    throw err;
  }
}

export async function getDeck(id: string): Promise<Deck | undefined> {
  const db = await getDB();
  const persisted = await db.get(DECKS_STORE, id);
  if (!persisted) return undefined;
  return fromPersisted(persisted) ?? undefined;
}

export async function deleteDeck(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([DECKS_STORE, MEDIA_STORE], "readwrite");
  await tx.objectStore(DECKS_STORE).delete(id);
  const mediaIndex = tx.objectStore(MEDIA_STORE).index("deckId");
  let cursor = await mediaIndex.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function listDecks(): Promise<Deck[]> {
  const db = await getDB();
  const all = await db.getAll(DECKS_STORE);
  return all
    .map(fromPersisted)
    .filter((d): d is Deck => d !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteOldestDeck(): Promise<string | null> {
  const db = await getDB();
  const all = await db.getAll(DECKS_STORE);
  if (all.length === 0) return null;
  const oldest = [...all].sort((a, b) => a.updatedAt - b.updatedAt)[0];
  if (!oldest) return null;
  await deleteDeck(oldest.id);
  return oldest.id;
}

export async function clearAllDecks(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction([DECKS_STORE, MEDIA_STORE], "readwrite");
  await tx.objectStore(DECKS_STORE).clear();
  await tx.objectStore(MEDIA_STORE).clear();
  await tx.done;
}

export async function putMedia(blob: DeckMediaBlob): Promise<void> {
  try {
    const db = await getDB();
    await db.put(MEDIA_STORE, blob);
  } catch (err) {
    if (isQuotaError(err)) throw new QuotaExceededError();
    throw err;
  }
}

export async function getMedia(id: string): Promise<DeckMediaBlob | undefined> {
  const db = await getDB();
  return db.get(MEDIA_STORE, id);
}

export async function listMediaForDeck(
  deckId: string,
): Promise<DeckMediaBlob[]> {
  const db = await getDB();
  return db.getAllFromIndex(MEDIA_STORE, "deckId", deckId);
}
