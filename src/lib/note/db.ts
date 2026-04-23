import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { ExportTheme } from "@/lib/theme/types";
import type { ChunkAnchor, OrderingWarning } from "@/lib/pipeline/types";

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
  // Schema version for migrations.
  _schemaVersion: number;
};

interface PowershotDB extends DBSchema {
  notes: {
    key: string;
    value: PersistedNote;
  };
}

const DB_NAME = "powershot";
const STORE_NAME = "notes";
const CURRENT_SCHEMA_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PowershotDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PowershotDB>> {
  if (dbPromise) return dbPromise;
  dbPromise = openDB<PowershotDB>(DB_NAME, CURRENT_SCHEMA_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    },
  });
  return dbPromise;
}

export class QuotaExceededError extends Error {
  constructor() {
    super("Storage quota exceeded. Please delete some older notes to free up space.");
    this.name = "QuotaExceededError";
  }
}

export async function saveNote(note: PersistedNote): Promise<void> {
  try {
    const db = await getDB();
    await db.put(STORE_NAME, { ...note, _schemaVersion: CURRENT_SCHEMA_VERSION });
  } catch (err) {
    if (isQuotaError(err)) {
      throw new QuotaExceededError();
    }
    throw err;
  }
}

function isQuotaError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      err.name === "QuotaExceededError" ||
      err.message.includes("quota") ||
      err.message.includes("storage")
    );
  }
  return false;
}

export async function deleteOldestNote(): Promise<string | null> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  if (all.length === 0) return null;
  const oldest = all.sort((a, b) => a.updatedAt - b.updatedAt)[0];
  if (!oldest) return null;
  await db.delete(STORE_NAME, oldest.id);
  return oldest.id;
}

export async function getNote(id: string): Promise<PersistedNote | undefined> {
  const db = await getDB();
  return db.get(STORE_NAME, id);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function listNotes(): Promise<PersistedNote[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function clearAllNotes(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}
