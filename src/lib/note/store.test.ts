import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultTheme } from "@/lib/theme/presets";
import type { PersistedNote } from "./db";

const dbMocks = vi.hoisted(() => {
  const persisted = new Map<string, PersistedNote>();

  return {
    persisted,
    saveNote: vi.fn(async (note: PersistedNote) => {
      persisted.set(note.id, JSON.parse(JSON.stringify(note)) as PersistedNote);
    }),
    getNote: vi.fn(async (id: string) => persisted.get(id)),
    deleteNote: vi.fn(async (id: string) => {
      persisted.delete(id);
    }),
    listNotes: vi.fn(async () =>
      [...persisted.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    ),
    deleteOldestNote: vi.fn(async () => {
      const oldest = [...persisted.values()].sort(
        (a, b) => a.updatedAt - b.updatedAt,
      )[0];
      if (!oldest) return null;
      persisted.delete(oldest.id);
      return oldest.id;
    }),
  };
});

const nanoidMock = vi.hoisted(() => ({
  counter: 0,
  next: vi.fn(() => `note-${++nanoidMock.counter}`),
}));

vi.mock("./db", () => ({
  deleteOldestNote: dbMocks.deleteOldestNote,
  saveNote: dbMocks.saveNote,
  getNote: dbMocks.getNote,
  deleteNote: dbMocks.deleteNote,
  listNotes: dbMocks.listNotes,
  QuotaExceededError: class QuotaExceededError extends Error {},
}));

vi.mock("nanoid", () => ({
  nanoid: nanoidMock.next,
}));

import {
  appendToNote,
  createNote,
  deleteNote,
  getNote,
  listNotes,
  updateNote,
} from "./store";

function image(id: string, name = `${id}.png`) {
  return {
    id,
    file: new File(["image"], name, { type: "image/png" }),
    objectUrl: `blob:${id}`,
    previewUrl: `blob:${id}`,
    detectedAt: null,
    timestampSource: "insertion" as const,
  };
}

describe("note store", () => {
  beforeEach(() => {
    dbMocks.persisted.clear();
    dbMocks.saveNote.mockClear();
    dbMocks.getNote.mockClear();
    dbMocks.deleteNote.mockClear();
    dbMocks.listNotes.mockClear();
    dbMocks.deleteOldestNote.mockClear();
    nanoidMock.counter = 0;
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    window.dispatchEvent(new Event("beforeunload"));
  });

  it("keeps images in session cache while persisting image-free notes", async () => {
    const created = await createNote({
      title: "   ",
      images: [image("img-1")],
      markdown: "Alpha",
      extractedMarkdown: "Alpha",
      anchors: [{ imageId: "img-1", startOffset: 0, endOffset: 5 }],
      warnings: [],
      tokenSubsetViolations: null,
    });

    expect(created.id).toBe("note-1");
    expect(created.title).toBe("Untitled note");
    expect(created.images).toHaveLength(1);
    expect(created.preferences).toEqual(defaultTheme);
    expect(dbMocks.saveNote).toHaveBeenCalledOnce();
    expect(dbMocks.saveNote.mock.calls[0]?.[0]).toEqual({
      id: "note-1",
      title: "Untitled note",
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      markdown: "Alpha",
      extractedMarkdown: "Alpha",
      anchors: [{ imageId: "img-1", startOffset: 0, endOffset: 5 }],
      warnings: [],
      tokenSubsetViolations: null,
      chunks: [],
      preferences: defaultTheme,
      _schemaVersion: 2,
    });
    expect(created.transient).toBe(false);

    const hydrated = await getNote(created.id);
    const listed = await listNotes();

    expect(hydrated?.images).toHaveLength(1);
    expect(listed[0]?.images).toEqual([]);
  });

  it("appends markdown, shifts anchors, and merges warnings and violations", async () => {
    await createNote({
      title: "Lecture",
      images: [image("img-1")],
      markdown: "Alpha",
      extractedMarkdown: "Alpha",
      anchors: [{ imageId: "img-1", startOffset: 0, endOffset: 5 }],
      warnings: [{ afterChunk: 0, beforeChunk: 1, reason: "initial" }],
      tokenSubsetViolations: ["before"],
    });

    const updated = await appendToNote("note-1", {
      markdown: "Beta",
      extractedMarkdown: "Beta",
      anchors: [{ imageId: "img-2", startOffset: 0, endOffset: 4 }],
      warnings: [{ afterChunk: 1, beforeChunk: 2, reason: "appended" }],
      tokenSubsetViolations: ["after"],
    });

    expect(updated?.markdown).toBe("Alpha\n\nBeta");
    expect(updated?.extractedMarkdown).toBe("Alpha\n\nBeta");
    expect(updated?.anchors).toEqual([
      { imageId: "img-1", startOffset: 0, endOffset: 5 },
      { imageId: "img-2", startOffset: 7, endOffset: 11 },
    ]);
    expect(updated?.warnings).toEqual([
      { afterChunk: 0, beforeChunk: 1, reason: "initial" },
      { afterChunk: 1, beforeChunk: 2, reason: "appended" },
    ]);
    expect(updated?.tokenSubsetViolations).toEqual(["before", "after"]);
  });

  it("updates persisted content and falls back to image-free hydration after unload", async () => {
    const created = await createNote({
      title: "Draft",
      images: [image("img-1")],
      markdown: "Alpha",
      extractedMarkdown: "Alpha",
      anchors: [{ imageId: "img-1", startOffset: 0, endOffset: 5 }],
      warnings: [],
      tokenSubsetViolations: null,
    });

    const updated = await updateNote(created.id, {
      markdown: "Edited",
      preferences: {
        ...defaultTheme,
        preset: "sepia",
      },
    });

    expect(updated?.markdown).toBe("Edited");
    expect(updated?.preferences.preset).toBe("sepia");

    window.dispatchEvent(new Event("beforeunload"));

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:img-1");

    const rehydrated = await getNote(created.id);
    expect(rehydrated?.images).toEqual([]);
    expect(rehydrated?.markdown).toBe("Edited");
    expect(rehydrated?.preferences.preset).toBe("sepia");
  });

  it("keeps transient notes in session only", async () => {
    const created = await createNote({
      title: "Sample note",
      images: [image("img-1")],
      markdown: "Transient",
      extractedMarkdown: "Transient",
      anchors: [],
      warnings: [],
      tokenSubsetViolations: null,
      transient: true,
    });

    expect(created.transient).toBe(true);
    expect(dbMocks.saveNote).not.toHaveBeenCalled();
    expect(await getNote(created.id)).toMatchObject({
      id: created.id,
      transient: true,
      markdown: "Transient",
    });

    window.dispatchEvent(new Event("beforeunload"));

    await expect(getNote(created.id)).resolves.toBeUndefined();
  });

  it("revokes object URLs and deletes the note from persistence", async () => {
    const created = await createNote({
      title: "Delete me",
      images: [image("img-1"), image("img-2")],
      markdown: "Alpha",
      extractedMarkdown: "Alpha",
      anchors: [],
      warnings: [],
      tokenSubsetViolations: null,
    });

    await expect(deleteNote(created.id)).resolves.toBe(true);

    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:img-1");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:img-2");
    expect(dbMocks.deleteNote).toHaveBeenCalledExactlyOnceWith(created.id);
    await expect(getNote(created.id)).resolves.toBeUndefined();
  });
});
