import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Card, Deck } from "./types";
import { DEFAULT_DECK_PREFERENCES, initialSM2State } from "./types";

const dbMocks = vi.hoisted(() => {
  const persisted = new Map<string, Deck>();

  return {
    persisted,
    saveDeck: vi.fn(async (deck: Deck) => {
      persisted.set(deck.id, JSON.parse(JSON.stringify(deck)) as Deck);
    }),
    getDeck: vi.fn(async (id: string) => persisted.get(id)),
    deleteDeck: vi.fn(async (id: string) => {
      persisted.delete(id);
    }),
    listDecks: vi.fn(async () =>
      [...persisted.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    ),
    deleteOldestDeck: vi.fn(async () => null),
  };
});

const nanoidMock = vi.hoisted(() => ({
  counter: 0,
  nanoid: vi.fn((size?: number) => `id-${size ?? "x"}-${++nanoidMock.counter}`),
}));

vi.mock("./db", () => ({
  saveDeck: dbMocks.saveDeck,
  getDeck: dbMocks.getDeck,
  deleteDeck: dbMocks.deleteDeck,
  listDecks: dbMocks.listDecks,
  deleteOldestDeck: dbMocks.deleteOldestDeck,
  QuotaExceededError: class QuotaExceededError extends Error {},
}));

vi.mock("nanoid", () => ({
  nanoid: nanoidMock.nanoid,
}));

import {
  appendCardsToDeck,
  createDeck,
  deleteDeck,
  getDeck,
  listDecks,
  saveDeck,
  updateCardInDeck,
  updateDeck,
} from "./store";

const NOW = 1_700_000_000_000;

function card(id: string): Card {
  return {
    id,
    model: "basic",
    style: "basic-qa",
    difficulty: "medium",
    front: `Front ${id}`,
    back: `Back ${id}`,
    tags: ["style:basic-qa", "difficulty:medium"],
    scheduler: initialSM2State(NOW),
    createdAt: NOW,
    updatedAt: NOW,
  };
}

describe("flashcard deck store", () => {
  beforeEach(() => {
    dbMocks.persisted.clear();
    dbMocks.saveDeck.mockClear();
    dbMocks.getDeck.mockClear();
    dbMocks.deleteDeck.mockClear();
    dbMocks.listDecks.mockClear();
    nanoidMock.counter = 0;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates first-class deck entities with defaults but does not persist immediately", () => {
    const deck = createDeck({
      name: "   ",
      subject: "  Biology  ",
      description: "  Endocrine  ",
    });

    expect(deck).toEqual({
      id: "id-12-1",
      name: "Untitled deck",
      subject: "Biology",
      description: "Endocrine",
      createdAt: NOW,
      updatedAt: NOW,
      cards: [],
      reviewState: {
        sessionsCompleted: 0,
        lastReviewedAt: null,
        currentStreakDays: 0,
      },
      preferences: DEFAULT_DECK_PREFERENCES,
      _schemaVersion: 1,
    });
    expect(dbMocks.saveDeck).not.toHaveBeenCalled();
  });

  it("saves decks and returns cached decks without re-reading IndexedDB", async () => {
    const deck = createDeck({ name: "Lecture deck", cards: [card("c1")] });

    await saveDeck(deck);
    const loaded = await getDeck(deck.id);

    expect(dbMocks.saveDeck).toHaveBeenCalledExactlyOnceWith(deck);
    expect(loaded).toBe(deck);
    expect(dbMocks.getDeck).not.toHaveBeenCalled();
  });

  it("updates deck metadata and appends cards with a fresh updatedAt", async () => {
    const deck = createDeck({ name: "Lecture deck", cards: [card("c1")] });
    await saveDeck(deck);
    vi.mocked(Date.now).mockReturnValue(NOW + 10);

    const renamed = await updateDeck(deck.id, { name: "Renamed" });
    const appended = await appendCardsToDeck(deck.id, [card("c2")]);

    expect(renamed?.name).toBe("Renamed");
    expect(renamed?.updatedAt).toBe(NOW + 10);
    expect(appended?.cards.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(appended?.updatedAt).toBe(NOW + 10);
    expect(dbMocks.saveDeck).toHaveBeenCalledTimes(3);
  });

  it("updates and deletes individual cards without touching other cards", async () => {
    const deck = createDeck({ name: "Lecture deck", cards: [card("c1"), card("c2")] });
    await saveDeck(deck);
    vi.mocked(Date.now).mockReturnValue(NOW + 20);

    const updated = await updateCardInDeck(deck.id, "c2", {
      front: "Edited front",
      guardrailViolations: ["invented"],
    });

    expect(updated?.cards[0]?.front).toBe("Front c1");
    expect(updated?.cards[1]).toMatchObject({
      id: "c2",
      front: "Edited front",
      guardrailViolations: ["invented"],
      updatedAt: NOW + 20,
    });
  });

  it("deletes cached and persisted decks, and reports missing decks", async () => {
    const deck = createDeck({ name: "Delete me" });
    await saveDeck(deck);

    await expect(deleteDeck(deck.id)).resolves.toBe(true);
    expect(dbMocks.deleteDeck).toHaveBeenCalledExactlyOnceWith(deck.id);

    await expect(deleteDeck("missing")).resolves.toBe(false);
  });

  it("lists persisted decks in database order", async () => {
    const older = createDeck({ name: "Older" });
    const newer = createDeck({ name: "Newer" });
    dbMocks.persisted.set(older.id, { ...older, updatedAt: NOW });
    dbMocks.persisted.set(newer.id, { ...newer, updatedAt: NOW + 10 });

    await expect(listDecks()).resolves.toEqual([
      { ...newer, updatedAt: NOW + 10 },
      older,
    ]);
  });
});
