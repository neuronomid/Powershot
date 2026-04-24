import initSqlJs from "sql.js";
import JSZip from "jszip";
import { join } from "node:path";
import type { Card, Deck, DeckMediaBlob } from "@/lib/flashcard/types";

const BASIC_MODEL_ID = 1735680000000;
const CLOZE_MODEL_ID = 1735680000001;
const DECK_ID = 1735680000002;

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function mediaExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function sanitizeMediaFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "card-media";
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

type MediaEntry = {
  zipName: string;
  filename: string;
  blob: DeckMediaBlob;
};

function buildMediaEntries(
  deck: Deck,
  mediaBlobs: DeckMediaBlob[],
): Map<string, MediaEntry> {
  const byId = new Map(mediaBlobs.map((blob) => [blob.id, blob]));
  const entries = new Map<string, MediaEntry>();
  let mediaIndex = 0;

  for (const card of deck.cards) {
    for (const ref of card.mediaRefs ?? []) {
      if (entries.has(ref.mediaId)) continue;
      const blob = byId.get(ref.mediaId);
      if (!blob) continue;
      const ext = mediaExtension(blob.mimeType);
      const base = sanitizeMediaFilename(blob.filenameHint ?? blob.id);
      entries.set(ref.mediaId, {
        zipName: `${mediaIndex}`,
        filename: `${base}-${mediaIndex}.${ext}`,
        blob,
      });
      mediaIndex++;
    }
  }

  return entries;
}

function mediaHtmlForRole(
  card: Card,
  role: "front" | "back",
  mediaEntries: Map<string, MediaEntry>,
): string {
  const tags = (card.mediaRefs ?? [])
    .filter((ref) => ref.role === role)
    .map((ref) => mediaEntries.get(ref.mediaId))
    .filter((entry): entry is MediaEntry => Boolean(entry))
    .map(
      (entry) =>
        `<br><img src="${escapeHtmlAttribute(entry.filename)}">`,
    );
  return tags.join("");
}

function buildBasicModel() {
  return {
    id: `${BASIC_MODEL_ID}`,
    name: "Basic",
    type: 0,
    mod: nowSeconds(),
    usn: -1,
    sortf: 0,
    did: DECK_ID,
    tmpls: [
      {
        name: "Card 1",
        ord: 0,
        qfmt: "{{Front}}",
        afmt: "{{FrontSide}}\n\n<hr id=answer>\n\n{{Back}}",
        did: null,
        bqfmt: "",
        bafmt: "",
      },
    ],
    flds: [
      { name: "Front", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
      { name: "Back", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
    ],
    css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; }",
    req: [[0, "any", [0]]],
    tags: [],
    vers: [],
    latexPre:
      "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
  };
}

function buildClozeModel() {
  return {
    id: `${CLOZE_MODEL_ID}`,
    name: "Cloze",
    type: 1,
    mod: nowSeconds(),
    usn: -1,
    sortf: 0,
    did: DECK_ID,
    tmpls: [
      {
        name: "Cloze",
        ord: 0,
        qfmt: "{{cloze:Text}}",
        afmt: "{{cloze:Text}}<br>\\n{{Extra}}",
        did: null,
        bqfmt: "",
        bafmt: "",
      },
    ],
    flds: [
      { name: "Text", ord: 0, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
      { name: "Extra", ord: 1, sticky: false, rtl: false, font: "Arial", size: 20, media: [] },
    ],
    css: ".card { font-family: arial; font-size: 20px; text-align: center; color: black; background-color: white; } .cloze { font-weight: bold; color: blue; }",
    req: [[0, "all", [0]]],
    tags: [],
    vers: [],
    latexPre:
      "\\documentclass[12pt]{article}\n\\special{papersize=3in,5in}\n\\usepackage[utf8]{inputenc}\n\\usepackage{amssymb,amsmath}\n\\pagestyle{empty}\n\\setlength{\\parindent}{0in}\n\\begin{document}\n",
    latexPost: "\\end{document}",
  };
}

function buildDeckJson(name: string) {
  return {
    [DECK_ID]: {
      id: DECK_ID,
      name,
      desc: "",
      mod: nowSeconds(),
      usn: -1,
      collapsed: false,
      browserCollapsed: false,
      dyn: 0,
      newToday: [0, 0],
      revToday: [0, 0],
      lrnToday: [0, 0],
      timeToday: [0, 0],
      conf: 1,
      extendNew: 0,
      extendRev: 50,
    },
  };
}

function buildDconfJson() {
  return {
    1: {
      id: 1,
      name: "Default",
      mod: 0,
      usn: 0,
      maxTaken: 60,
      autoplay: true,
      timer: 0,
      replayq: true,
      new: {
        bury: true,
        delays: [1, 10],
        initialFactor: 2500,
        ints: [1, 4, 7],
        order: 1,
        perDay: 20,
      },
      rev: {
        bury: true,
        ease4: 1.3,
        ivlFct: 1,
        maxIvl: 36500,
        perDay: 100,
        fuzz: 0.05,
      },
      lapse: {
        delays: [10],
        mult: 0,
        minInt: 1,
        leechFails: 8,
        leechAction: 0,
      },
      dyn: false,
    },
  };
}

function buildConfJson() {
  return {
    curModel: `${BASIC_MODEL_ID}`,
    activeDecks: [DECK_ID],
    addedTags: [],
    sortType: "noteFld",
    timeLimit: 0,
    sortBackwards: false,
    newBury: true,
    dayLearnFirst: false,
    newSpread: 0,
    collapseTime: 1200,
    activeCols: [],
    dueCounts: true,
    curDeck: DECK_ID,
  };
}

export async function deckToApkg(
  deck: Deck,
  mediaBlobs: DeckMediaBlob[],
): Promise<Uint8Array> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      file.endsWith(".wasm")
        ? join(process.cwd(), "node_modules", "sql.js", "dist", file)
        : file,
  });
  const db = new SQL.Database();
  const mediaEntries = buildMediaEntries(deck, mediaBlobs);

  db.run(`
    CREATE TABLE col (
      id integer PRIMARY KEY,
      crt integer NOT NULL,
      mod integer NOT NULL,
      scm integer NOT NULL,
      ver integer NOT NULL,
      dty integer NOT NULL,
      usn integer NOT NULL,
      ls integer NOT NULL,
      conf text NOT NULL,
      models text NOT NULL,
      decks text NOT NULL,
      dconf text NOT NULL,
      tags text NOT NULL
    );
    CREATE TABLE notes (
      id integer PRIMARY KEY,
      guid text NOT NULL,
      mid integer NOT NULL,
      mod integer NOT NULL,
      usn integer NOT NULL,
      tags text NOT NULL,
      flds text NOT NULL,
      sfld text NOT NULL,
      csum integer NOT NULL,
      flags integer NOT NULL,
      data text NOT NULL
    );
    CREATE TABLE cards (
      id integer PRIMARY KEY,
      nid integer NOT NULL,
      did integer NOT NULL,
      ord integer NOT NULL,
      mod integer NOT NULL,
      usn integer NOT NULL,
      type integer NOT NULL,
      queue integer NOT NULL,
      due integer NOT NULL,
      ivl integer NOT NULL,
      factor integer NOT NULL,
      reps integer NOT NULL,
      lapses integer NOT NULL,
      left integer NOT NULL,
      odue integer NOT NULL,
      odid integer NOT NULL,
      flags integer NOT NULL,
      data text NOT NULL
    );
    CREATE TABLE revlog (
      id integer PRIMARY KEY,
      cid integer NOT NULL,
      usn integer NOT NULL,
      ease integer NOT NULL,
      ivl integer NOT NULL,
      lastIvl integer NOT NULL,
      factor integer NOT NULL,
      time integer NOT NULL,
      type integer NOT NULL
    );
    CREATE TABLE graves (
      usn integer NOT NULL,
      oid integer NOT NULL,
      type integer NOT NULL
    );
  `);

  const colValues = [
    1,
    nowSeconds(),
    Date.now(),
    Date.now(),
    11,
    0,
    0,
    0,
    JSON.stringify(buildConfJson()),
    JSON.stringify({
      [BASIC_MODEL_ID]: buildBasicModel(),
      [CLOZE_MODEL_ID]: buildClozeModel(),
    }),
    JSON.stringify(buildDeckJson(deck.name)),
    JSON.stringify(buildDconfJson()),
    "{}",
  ];

  db.run(
    "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    colValues,
  );

  for (let i = 0; i < deck.cards.length; i++) {
    const card = deck.cards[i];
    const noteId = Date.now() + i;
    const cardId = noteId + 1;
    const isCloze = card.model === "cloze";
    const mid = isCloze ? CLOZE_MODEL_ID : BASIC_MODEL_ID;
    const front = `${card.front}${mediaHtmlForRole(card, "front", mediaEntries)}`;
    const back = `${card.back}${mediaHtmlForRole(card, "back", mediaEntries)}`;
    const extra = `${card.extra ?? ""}${mediaHtmlForRole(card, "back", mediaEntries)}`;

    const flds = isCloze
      ? `${front}\x1f${extra}`
      : `${front}\x1f${back}`;
    const sfld = card.front;
    const tags = card.tags.join(" ");

    db.run(
      "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
      [noteId, `${noteId}`, mid, nowSeconds(), -1, tags, flds, sfld, 0, 0, "{}"],
    );

    const ivl = Math.max(0, Math.round(card.scheduler.intervalDays));
    const factor = Math.max(1300, Math.round(card.scheduler.ease * 1000));

    db.run(
      "INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        cardId,
        noteId,
        DECK_ID,
        0,
        nowSeconds(),
        -1,
        0,
        0,
        i,
        ivl,
        factor,
        card.scheduler.repetitions,
        card.scheduler.lapses,
        0,
        0,
        0,
        0,
        "{}",
      ],
    );

  }

  const dbBuffer = db.export();
  db.close();

  const zip = new JSZip();
  zip.file("collection.anki2", dbBuffer);

  const mediaManifest: Record<string, string> = {};
  for (const entry of mediaEntries.values()) {
    mediaManifest[entry.zipName] = entry.filename;
    const bytes = Uint8Array.from(atob(entry.blob.dataBase64), (c) =>
      c.charCodeAt(0),
    );
    zip.file(entry.zipName, bytes);
  }
  zip.file("media", JSON.stringify(mediaManifest));

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });
  return zipBuffer;
}
