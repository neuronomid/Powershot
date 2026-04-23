import { nanoid } from "nanoid";

import type { ChunkAnchor, OrderingWarning } from "@/lib/pipeline/types";
import type { StagedImage } from "@/lib/upload/types";
import type { ExportTheme } from "@/lib/theme/types";
import { defaultTheme } from "@/lib/theme/presets";
import type { Note, NotePatch } from "./types";
import * as db from "./db";

export { QuotaExceededError } from "./db";
export const deleteOldestNote = db.deleteOldestNote;

// In-memory session cache. Notes with images live here for the current session.
// IndexedDB holds the persisted copy (no images).
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
  preferences?: ExportTheme;
}): Promise<Note> {
  const now = Date.now();
  const note: Note = {
    id: createNoteId(),
    title: params.title?.trim() || "Untitled note",
    createdAt: now,
    updatedAt: now,
    images: params.images,
    markdown: params.markdown,
    extractedMarkdown: params.extractedMarkdown,
    anchors: params.anchors,
    warnings: params.warnings,
    tokenSubsetViolations: params.tokenSubsetViolations,
    preferences: params.preferences ?? defaultTheme,
  };
  sessionCache.set(note.id, note);
  await db.saveNote(toPersisted(note));
  return note;
}

export async function getNote(id: string): Promise<Note | undefined> {
  // 1. Check session cache first (may have images from current session)
  const cached = sessionCache.get(id);
  if (cached) return cached;

  // 2. Fall back to IndexedDB
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
  await db.saveNote(toPersisted(updated));
  return updated;
}

export async function deleteNote(id: string): Promise<boolean> {
  const note = sessionCache.get(id) ?? (await db.getNote(id));
  if (!note) return false;

  // Revoke object URLs to prevent memory leaks.
  const images = "images" in note ? (note as Note).images : [];
  for (const img of images) {
    try {
      URL.revokeObjectURL(img.objectUrl);
    } catch {
      /* ignore */
    }
  }

  sessionCache.delete(id);
  await db.deleteNote(id);
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
  },
): Promise<Note | undefined> {
  const existing = await getNote(id);
  if (!existing) return undefined;

  // Append new markdown with a blank line separator.
  const newMarkdown = existing.markdown
    ? `${existing.markdown}\n\n${params.markdown}`
    : params.markdown;
  const newExtracted = existing.extractedMarkdown
    ? `${existing.extractedMarkdown}\n\n${params.extractedMarkdown}`
    : params.extractedMarkdown;

  // Merge anchors: shift new anchors by the length of existing markdown + 2 for separator.
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
    updatedAt: Date.now(),
  };

  sessionCache.set(id, updated);
  await db.saveNote(toPersisted(updated));
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
    preferences: note.preferences,
    _schemaVersion: 1,
  };
}

function fromPersisted(p: db.PersistedNote): Note {
  return {
    id: p.id,
    title: p.title,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    images: [], // Images are not persisted across sessions.
    markdown: p.markdown,
    extractedMarkdown: p.extractedMarkdown,
    anchors: p.anchors,
    warnings: p.warnings,
    tokenSubsetViolations: p.tokenSubsetViolations,
    preferences: p.preferences,
  };
}

// Clean up all object URLs on page unload to avoid leaks.
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
