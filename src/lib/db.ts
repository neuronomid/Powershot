import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { ExportTheme } from "@/lib/theme/types";
import type { ChunkAnchor, OrderingWarning, ChunkMeta } from "@/lib/pipeline/types";
import type { DeckMediaBlob } from "@/lib/flashcard/types";

export type PersistedNote = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  markdown: string;
  extractedMarkdown: string;
  anchors: ChunkAnchor[];
  warnings: OrderingWarning[];
  tokenSubsetViolations: string[] | null;
  preferences: ExportTheme;
  chunks: ChunkMeta[];
  _schemaVersion: number;
};

export type PersistedDeckSummary = {
  id: string;
  name: string;
  subject?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  cardCount: number;
  dueCount: number;
};

export type PersistedDeck = {
  id: string;
  name: string;
  subject?: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  // `cards` is stored inline. Decks of 200–500 cards are small (<100KB).
  data: unknown;
  _schemaVersion: number;
};

export interface PowershotDB extends DBSchema {
  notes: {
    key: string;
    value: PersistedNote;
  };
  decks: {
    key: string;
    value: PersistedDeck;
  };
  deckMedia: {
    key: string;
    value: DeckMediaBlob;
    indexes: { deckId: string };
  };
}

const DB_NAME = "powershot";
const CURRENT_SCHEMA_VERSION = 3;

let dbPromise: Promise<IDBPDatabase<PowershotDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PowershotDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<PowershotDB>(DB_NAME, CURRENT_SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore("notes", { keyPath: "id" });
      }
      // v1→v2: added `chunks` field on notes (no structural migration).
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains("decks")) {
          db.createObjectStore("decks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("deckMedia")) {
          const media = db.createObjectStore("deckMedia", { keyPath: "id" });
          media.createIndex("deckId", "deckId", { unique: false });
        }
      }
    },
  });
  return dbPromise;
}

export class QuotaExceededError extends Error {
  constructor() {
    super("Storage quota exceeded. Please delete some older items to free up space.");
    this.name = "QuotaExceededError";
  }
}

export function isQuotaError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === "QuotaExceededError" ||
      err.message.includes("quota") ||
      err.message.includes("storage")
    );
  }
  return false;
}

export { CURRENT_SCHEMA_VERSION };
