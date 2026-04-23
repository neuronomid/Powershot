import { nanoid } from "nanoid";

import type { ChunkAnchor, OrderingWarning, ChunkMeta } from "@/lib/pipeline/types";
import type { StagedImage } from "@/lib/upload/types";
import type { ExportTheme } from "@/lib/theme/types";
import { defaultTheme } from "@/lib/theme/presets";
import type { Note, NotePatch } from "./types";
import * as db from "./db";

export { QuotaExceededError } from "./db";
export const deleteOldestNote = db.deleteOldestNote;

const sessionCache = new Map<string, Note>();

function createNoteId(): string {
  return nanoid(12);
}

export async function createNote(params: {
  title?: string;
  images: StagedImage[];
  markdown: string;
  extractedMarkdown: string;
  anchors: ChunkAnchor[];
  warnings: OrderingWarning[];
  tokenSubsetViolations: string[] | null;
  chunks?: ChunkMeta[];
  preferences?: ExportTheme;
  transient?: boolean;
}): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: createNoteId(),
    title: params.title?.trim() || "Untitled note",
    createdAt: now,
    updatedAt: now,
    transient: params.transient ?? false,
    images: params.images,
    markdown: params.markdown,
    extractedMarkdown: params.extractedMarkdown,
    anchors: params.anchors,
    warnings: params.warnings,
    tokenSubsetViolations: params.tokenSubsetViolations,
    chunks: params.chunks ?? [],
    preferences: params.preferences ?? defaultTheme,
  };
  sessionCache.set(note.id, note);
  if (!note.transient) {
    await db.saveNote(toPersisted(note));
  }
  return note;
}

export async function getNote(id: string): Promise<Note | undefined> {
  const cached = sessionCache.get(id);
  if (cached) return cached;

  const persisted = await db.getNote(id);
  if (!persisted) return undefined;

  const note = fromPersisted(persisted);
  sessionCache.set(id, note);
  return note;
}

export async function updateNote(
  id: string,
  patch: NotePatch,
): Promise<Note | undefined> {
  const existing = sessionCache.get(id) ?? (await db.getNote(id));
  if (!existing) return undefined;

  const updated: Note =
    "images" in existing
      ? { ...(existing as Note), ...patch, updatedAt: Date.now() }
      : { ...fromPersisted(existing as db.PersistedNote), ...patch, updatedAt: Date.now() };

  sessionCache.set(id, updated);
  if (!updated.transient) {
    await db.saveNote(toPersisted(updated));
  }
  return updated;
}

export async function deleteNote(id: string): Promise<boolean> {
  const note = sessionCache.get(id) ?? (await db.getNote(id));
  if (!note) return false;

  const images = "images" in note ? (note as Note).images : [];
  for (const img of images) {
    try {
      URL.revokeObjectURL(img.objectUrl);
    } catch {
      /* ignore */
    }
  }

  sessionCache.delete(id);
  if (!("transient" in note) || !(note as Note).transient) {
    await db.deleteNote(id);
  }
  return true;
}

export async function listNotes(): Promise<Note[]> {
  const persisted = await db.listNotes();
  return persisted.map(fromPersisted);
}

export async function appendToNote(
  id: string,
  params: {
    markdown: string;
    extractedMarkdown: string;
    anchors: ChunkAnchor[];
    warnings: OrderingWarning[];
    tokenSubsetViolations: string[] | null;
    chunks?: ChunkMeta[];
  },
): Promise<Note | undefined> {
  const existing = await getNote(id);
  if (!existing) return undefined;

  const newMarkdown = existing.markdown
    ? `${existing.markdown}\n\n${params.markdown}`
    : params.markdown;
  const newExtracted = existing.extractedMarkdown
    ? `${existing.extractedMarkdown}\n\n${params.extractedMarkdown}`
    : params.extractedMarkdown;

  const offset = existing.markdown.length + 2;
  const shiftedAnchors = params.anchors.map((a) => ({
    ...a,
    startOffset: a.startOffset + offset,
    endOffset: a.endOffset + offset,
  }));

  const updated: Note = {
    ...existing,
    markdown: newMarkdown,
    extractedMarkdown: newExtracted,
    anchors: [...existing.anchors, ...shiftedAnchors],
    warnings: [...existing.warnings, ...params.warnings],
    tokenSubsetViolations: existing.tokenSubsetViolations
      ? params.tokenSubsetViolations
        ? [...existing.tokenSubsetViolations, ...params.tokenSubsetViolations]
        : existing.tokenSubsetViolations
      : params.tokenSubsetViolations,
    chunks: [...existing.chunks, ...(params.chunks ?? [])],
    updatedAt: Date.now(),
  };

  sessionCache.set(id, updated);
  if (!updated.transient) {
    await db.saveNote(toPersisted(updated));
  }
  return updated;
}

// --- helpers ---

function toPersisted(note: Note): db.PersistedNote {
  return {
    id: note.id,
    title: note.title,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    markdown: note.markdown,
    extractedMarkdown: note.extractedMarkdown,
    anchors: note.anchors,
    warnings: note.warnings,
    tokenSubsetViolations: note.tokenSubsetViolations,
    chunks: note.chunks,
    preferences: note.preferences,
    _schemaVersion: 2,
  };
}

function fromPersisted(p: db.PersistedNote): Note {
  return {
    id: p.id,
    title: p.title,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    transient: false,
    images: [],
    markdown: p.markdown,
    extractedMarkdown: p.extractedMarkdown,
    anchors: p.anchors,
    warnings: p.warnings,
    tokenSubsetViolations: p.tokenSubsetViolations,
    chunks: p.chunks ?? [],
    preferences: p.preferences,
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    for (const note of sessionCache.values()) {
      for (const img of note.images) {
        try {
          URL.revokeObjectURL(img.objectUrl);
        } catch {
          /* ignore */
        }
      }
    }
    sessionCache.clear();
  });
}
