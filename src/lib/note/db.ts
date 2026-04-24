import {
  CURRENT_SCHEMA_VERSION,
  QuotaExceededError,
  getDB,
  isQuotaError,
  type PersistedNote,
} from "@/lib/db";

export { QuotaExceededError };
export type { PersistedNote };

const STORE_NAME = "notes";

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
  const note = await db.get(STORE_NAME, id);
  if (!note) return undefined;
  return normalizeNote(note);
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}

export async function listNotes(): Promise<PersistedNote[]> {
  const db = await getDB();
  const all = await db.getAll(STORE_NAME);
  return all
    .map(normalizeNote)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function clearAllNotes(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
}

function normalizeNote(note: PersistedNote): PersistedNote {
  return {
    ...note,
    chunks: (note.chunks ?? []).map((c) => ({
      imageId: c.imageId,
      imageIndex: c.imageIndex ?? 0,
      model: c.model ?? "",
      croppedRegion: c.croppedRegion ?? null,
      enhanced: c.enhanced ?? false,
      source: c.source ?? "screenshot",
    })),
    _schemaVersion: note._schemaVersion ?? 1,
  };
}
