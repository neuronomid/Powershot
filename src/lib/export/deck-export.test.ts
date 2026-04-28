import JSZip from "jszip";
import initSqlJs from "sql.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { initialSM2State, type Deck, type DeckMediaBlob } from "@/lib/flashcard/types";
import { deckToApkg } from "./deck-to-apkg";
import { deckToCsv } from "./deck-to-csv";
import { buildDeckPdfHtml } from "./deck-to-pdf";
import { deckToTsv } from "./deck-to-tsv";

const NOW = 1_700_000_000_000;

function fixtureDeck(): Deck {
  return {
    id: "deck-1",
    name: "Bio <Deck>",
    subject: "Cell Biology",
    createdAt: NOW,
    updatedAt: NOW,
    cards: [
      {
        id: "card-1",
        model: "basic",
        style: "basic-qa",
        difficulty: "medium",
        front: "What does ATP synthase produce?\nPick one",
        back: "ATP, the cell's \"energy\" currency",
        extra: "ATP synthase",
        mediaRefs: [{ mediaId: "media-1", role: "front", alt: "Diagram" }],
        tags: ["style:basic-qa", "difficulty:medium"],
        scheduler: initialSM2State(NOW),
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        id: "card-2",
        model: "cloze",
        style: "cloze",
        difficulty: "easy",
        front: "The {{c1::mitochondria}} produce ATP.",
        back: "",
        tags: ["style:cloze", "difficulty:easy"],
        scheduler: { ...initialSM2State(NOW), intervalDays: 3, repetitions: 2 },
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    reviewState: {
      sessionsCompleted: 0,
      lastReviewedAt: null,
      currentStreakDays: 0,
    },
    preferences: {
      styles: [{ style: "basic-qa", count: 1 }],
      difficulty: "medium",
      styleAutoPick: true,
      generationInstructions: "",
    },
    _schemaVersion: 1,
  };
}

const mediaBlobs: DeckMediaBlob[] = [
  {
    id: "media-1",
    deckId: "deck-1",
    mimeType: "image/jpeg",
    dataBase64: Buffer.from([1, 2, 3, 4]).toString("base64"),
    filenameHint: "ATP diagram.png",
    createdAt: NOW,
  },
];

describe("deck export generators", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports Anki-importable TSV with front, back, and tags columns", () => {
    const tsv = deckToTsv(fixtureDeck());

    expect(tsv).toBe(
      [
        "What does ATP synthase produce? Pick one\tATP, the cell's \"energy\" currency\tstyle:basic-qa difficulty:medium",
        "The {{c1::mitochondria}} produce ATP.\t\tstyle:cloze difficulty:easy",
      ].join("\n"),
    );
  });

  it("exports CSV with a header and proper spreadsheet quoting", () => {
    const csv = deckToCsv(fixtureDeck());

    expect(csv).toBe(
      [
        "front,back,tags",
        '"What does ATP synthase produce?\nPick one","ATP, the cell\'s ""energy"" currency",style:basic-qa difficulty:medium',
        "The {{c1::mitochondria}} produce ATP.,,style:cloze difficulty:easy",
      ].join("\n"),
    );
  });

  it("builds escaped print-friendly deck HTML", () => {
    const html = buildDeckPdfHtml(fixtureDeck());

    expect(html).toContain("<title>Bio &lt;Deck&gt;</title>");
    expect(html).toContain("2 cards");
    expect(html).toContain("Cell Biology");
    expect(html).toContain("What does ATP synthase produce?<br>Pick one");
    expect(html).toContain("ATP, the cell&#39;s &quot;energy&quot; currency");
    expect(html).not.toContain("<Deck>");
  });

  it("packages APKG collection, media manifest, and SQLite rows", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const apkg = await deckToApkg(fixtureDeck(), mediaBlobs);
    const zip = await JSZip.loadAsync(apkg);

    const collection = zip.file("collection.anki2");
    const media = zip.file("media");
    expect(collection).toBeTruthy();
    expect(media).toBeTruthy();

    const manifest = JSON.parse(await media!.async("string")) as Record<string, string>;
    expect(manifest).toEqual({ "0": "ATP-diagram-0.jpg" });
    expect(zip.file("0")).toBeTruthy();
    await expect(zip.file("0")!.async("uint8array")).resolves.toEqual(
      Uint8Array.from([1, 2, 3, 4]),
    );

    const SQL = await initSqlJs();
    const db = new SQL.Database(await collection!.async("uint8array"));
    try {
      expect(db.exec("SELECT COUNT(*) FROM notes")[0]?.values[0]?.[0]).toBe(2);
      expect(db.exec("SELECT COUNT(*) FROM cards")[0]?.values[0]?.[0]).toBe(2);
      const models = String(db.exec("SELECT models FROM col")[0]?.values[0]?.[0]);
      expect(models).toContain("Basic");
      expect(models).toContain("Cloze");
      const fields = db.exec("SELECT flds FROM notes ORDER BY id")[0]?.values;
      expect(String(fields?.[0]?.[0])).toContain(
        '<img src="ATP-diagram-0.jpg">',
      );
      expect(String(fields?.[1]?.[0])).toContain("{{c1::mitochondria}}");
    } finally {
      db.close();
    }
  }, 15_000);
});
