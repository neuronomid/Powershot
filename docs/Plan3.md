# Powershot V3 — Flashcards: Plan

## Context

Powershot today is a screenshot → structured Markdown note tool. V3 adds a second, peer feature: screenshot → Anki-compatible flashcard decks. The two features share one extraction layer (VLM → Markdown) and diverge after that. The Markdown path produces notes; the Flashcards path produces decks of cards that are reviewable in-app and exportable to Anki.

The v1 load-bearing constraints (no server persistence of image or note data, per-image serverless calls, Node runtime 60s cap for AI routes, no paraphrasing of source content) all carry forward. Flashcard *questions* may be freely phrased, but flashcard *answer* text must remain subset-bounded against the source markdown — an adapted version of the existing token-subset guardrail.

Decks are first-class client-side entities (IndexedDB), independent from notes. An existing deck can be resumed: the user uploads new screenshots and appends new cards to it, with semantic dedup against existing cards to avoid duplicates.

This is planning for V3. Development phase slicing and subphase ordering are listed near the end but are not locked — v3.0 (MVP) vs v3.1 (refinement) boundaries should be treated as a starting proposal.

---

## High-level architecture

Two peer entry points in the header: **Notes** (current) and **Decks** (new). Both converge on a shared extraction pipeline; after extraction, each runs its own downstream stages.

```
screenshots ──► [extraction] ──┬──► [dedup] ──► [review] ──► Markdown → Note  (existing)
                               │
                               └──► [flashcard-gen] ──► [card-dedup] ──► Deck  (new)
```

Extraction, the OpenRouter wrapper, concurrency orchestration, and the `useBatchPipeline`-style hook are factored so both pipelines share the same foundation.

---

## Data model (IndexedDB)

New object store `decks` parallel to the existing `notes` store. Schema version bumps from 2 → 3.

```ts
// src/lib/flashcard/types.ts
type Deck = {
  id: string;                 // nanoid(12)
  name: string;
  subject?: string;           // free-text topic hint for AI when appending
  createdAt: number;
  updatedAt: number;
  cards: Card[];              // inline for v3.0 (decks of 200–500 cards are small)
  reviewState: DeckReviewState; // daily queue state, streak, last-reviewed
  preferences: DeckPreferences; // default types, counts, difficulty
  _schemaVersion: 1;
};

type Card = {
  id: string;
  model: "basic" | "cloze";   // Anki note model (two, not ten)
  style: FlashcardStyle;      // one of the 10 user-facing "types" (tag, not model)
  difficulty: "easy" | "medium" | "challenging";
  front: string;              // markdown
  back: string;               // markdown; for cloze, back is empty (front contains {{c1::...}})
  extra?: string;             // additional context shown after reveal
  mediaRefs?: string[];       // IndexedDB keys into a `deckMedia` store for image-bearing cards
  sourceImageIndex?: number;  // which screenshot this came from, for traceability
  tags: string[];             // includes style, difficulty, and any user tags
  scheduler: SM2State;        // ease, interval, repetitions, due, lapses
  createdAt: number;
  updatedAt: number;
};

type FlashcardStyle =
  | "basic-qa" | "concept" | "compare" | "mcq" | "error-based"
  | "application" | "cloze" | "explain-why" | "diagram" | "exam-short";
```

**Key decision:** the 10 user-facing "types" collapse to **2 Anki note models** (Basic, Cloze) plus a `style` tag. Anki itself works best with few note models. This keeps .apkg generation clean and still lets users filter and review by style in-app.

Image-bearing cards (type 9) store cropped image bytes in a separate `deckMedia` IndexedDB store keyed by a content hash. Media is bundled into `.apkg` at export. No server persistence.

---

## Flashcard generation pipeline

Runs **after** extraction+review (same Markdown output as the Notes path). This is cheap (text-only Flash call), reuses fidelity guarantees, and lets users regenerate cards without re-reading images.

Per screenshot (or per batched group), one AI call → JSON array of cards. Concurrency cap 4, reusing `runWithConcurrency` from `src/lib/pipeline/batch.ts:46`.

Inputs to the prompt:
- The reviewed markdown for that screenshot
- Requested styles + counts (from global config, overridden per screenshot)
- Target difficulty

Prompt constraints:
- Answers must be copyable spans from the source markdown (token-subset guardrail).
- Cloze cards use Anki cloze syntax `{{c1::...}}`, one `c1/c2/...` numbering per card.
- AI is allowed to **skip a requested style** for a screenshot if it doesn't fit (e.g. compare/contrast on a single-concept page) — quality over quota.
- Output is strict JSON; validated server-side.

For image-bearing (diagram) cards, the AI returns a region reference (x,y,w,h) relative to the source screenshot; the client crops the image from its transient buffer and stores the crop in `deckMedia` before discarding the source.

### Token-subset guardrail (adapted)
Existing `/api/review` guardrail: output tokens ⊆ input tokens. For flashcards: **answer tokens ⊆ source markdown tokens** (questions are free-form). Violations logged and surfaced as a soft warning on the card, not blocked.

### Incremental add (resume deck)
When a user adds screenshots to an existing deck:
1. Run extraction + review as usual.
2. Generate candidate cards.
3. **Semantic dedup pass** (`/api/flashcard/dedup`): Flash compares each candidate against existing deck cards, returns deletion indices (mirrors existing dedup contract — deletion spans only, no rewrites).
4. Surviving cards appended; user sees them flagged as "new" until first review.

---

## In-app review: SM-2-lite

One scheduler file: `src/lib/flashcard/sm2.ts`. Implements the well-known SM-2 variant Anki uses as its legacy default.

Per-card state: `{ ease, interval, repetitions, due, lapses }`.
Four review buttons: **Again / Hard / Good / Easy**.
- Again: ease −0.2, interval resets to learning step (1m / 10m), lapse +1.
- Hard: ease −0.15, interval × 1.2.
- Good: interval × ease, ease unchanged.
- Easy: interval × ease × 1.3, ease +0.15.
Ease clamped to [1.3, 2.5] initial, no upper bound from Easy bonus.

Daily queue built from `cards.filter(c => c.scheduler.due <= today)`. No retention optimizer, no FSRS. FSRS is deferred to v3.1 if users ask — it does not change the data model meaningfully (new scheduler fields, same card shape).

Review UI: one card at a time, flip to reveal, four buttons, undo-last-review, end session with summary.

---

## Exports (all four formats)

Extend `src/app/api/export/route.ts` and add generators under `src/lib/export/`:

| format | generator | scope |
|---|---|---|
| `.apkg` | `deck-to-apkg.ts` | Full Anki deck: SQLite `collection.anki2` + media + `media` JSON manifest, zipped. Two note models (Basic, Cloze). Tags include `style:*` and `difficulty:*`. Uses `genanki-js` or equivalent server-side library; fall back to hand-rolled via `sql.js` if no maintained lib exists. |
| `.tsv` | `deck-to-tsv.ts` | Tab-separated, Anki-importable plaintext. No media, no scheduling. Columns: `front \t back \t tags`. Cloze cards exported with `{{c1::...}}` syntax intact. |
| `.csv` | `deck-to-csv.ts` | Comma-separated, Anki- and spreadsheet-compatible. Same fields as .tsv with proper quoting. |
| `.pdf` | `deck-to-pdf.ts` | Print-friendly front/back layout, reuses existing Puppeteer + themed CSS path in `src/lib/export/`. |

All four exports are pure functions of the Deck (+ media store). No server persistence; response is a download.

---

## UI changes

**Header nav:** switch from logo-only to two-entry nav — **Notes** | **Decks** — with the active mode highlighted.

**New routes:**
- `/decks` — deck list (mirrors `/` home, shows cards-due badges).
- `/decks/new` — upload + config + generate. Reuses the Filmstrip from `src/components/upload/` including existing `onCrop`. Adds a config panel (global defaults + per-screenshot override popover on click).
- `/decks/[id]` — deck overview: card list, edit cards inline, export menu, "Add screenshots" to resume, start review session.
- `/decks/[id]/review` — SM-2-lite review session UI.

**Config panel shape (global):**
- Styles: multi-select of the 10 user-facing types (checkboxes).
- Count per style: one number input, or "let AI decide up to N".
- Difficulty: easy / medium / challenging.
- Per-screenshot override: click thumbnail → same panel but scoped to that image; empty means "use global".

---

## API routes (all Node runtime, `maxDuration = 60`)

- `POST /api/flashcard/generate` — input: reviewed markdown + config; output: array of cards (JSON, validated).
- `POST /api/flashcard/dedup` — input: candidate cards + existing deck cards (front/back only); output: deletion indices.
- `POST /api/export` — extended with `format=apkg|tsv|csv|pdf` (PDF/DOCX for notes already handled; new branch for deck exports).

---

## Files to create

```
src/lib/flashcard/
  types.ts                    — Deck, Card, SM2State, FlashcardStyle
  db.ts                       — IndexedDB, mirrors src/lib/note/db.ts
  store.ts                    — session cache + CRUD, mirrors src/lib/note/store.ts
  sm2.ts                      — scheduler
  generate.ts                 — client-side orchestration over /api/flashcard/generate
  dedup.ts                    — client-side orchestration over /api/flashcard/dedup
  media.ts                    — cropped-image store + hash-based keys

src/lib/pipeline/
  flashcard-batch.ts          — mirrors batch.ts; runs gen + dedup stages
  useDeckPipeline.ts          — React hook, parallels useBatchPipeline

src/lib/ai/
  prompts.ts                  — add FLASHCARD_SYSTEM_PROMPT, FLASHCARD_DEDUP_SYSTEM_PROMPT
  openrouter.ts               — add callFlashcardGen(), callFlashcardDedup()

src/lib/export/
  deck-to-apkg.ts
  deck-to-tsv.ts
  deck-to-csv.ts
  deck-to-pdf.ts

src/app/decks/
  page.tsx                    — deck list
  new/page.tsx                — upload + config + generate
  [id]/page.tsx               — deck overview + editor
  [id]/review/page.tsx        — review session

src/app/api/flashcard/
  generate/route.ts
  dedup/route.ts

src/components/deck/
  deck-card.tsx               — list item
  config-panel.tsx            — global + per-screenshot config
  per-screenshot-override.tsx — popover from thumbnail click
  card-editor.tsx             — inline card edit
  review-card.tsx             — flip + four buttons
  review-summary.tsx          — session end state
```

## Files to modify

- `src/lib/note/db.ts` — bump schema version 2 → 3; add `decks` and `deckMedia` object stores in the upgrade handler.
- `src/components/site-header.tsx` — add Notes / Decks nav.
- `src/app/api/export/route.ts` — add `apkg | tsv | csv` format cases; reuse existing PDF path for deck PDF.
- `src/lib/upload/*` — extract the filmstrip + config shell so `/new` and `/decks/new` both use it; no behavior change for `/new`.
- `src/lib/pipeline/batch.ts` — factor the extraction phase so both pipelines call it identically.
- `docs/PRD.md` / `docs/Plan.md` — leave untouched (v1 docs). Write new `docs/PRD3.md` / `docs/Plan3.md` mirroring the v2 pattern.

---

## Constraints honored

- **No server persistence.** Decks, cards, and media live in client IndexedDB only. The .apkg generator runs per-request and streams back to the user.
- **Per-image serverless calls.** Flashcard generation is one AI call per screenshot (text-only, Flash). Total batch time: extraction (existing) + roughly +2–4 s per image for card generation, running in parallel with concurrency cap 4.
- **Node runtime, 60s cap.** Both new API routes.
- **No paraphrasing** of source facts: answer-side token-subset guardrail. Question side is free.
- **`OPENROUTER_API_KEY` server-side only.**
- **Model chain** unchanged: Pro → Flash → Haiku via the existing wrapper.

---

## Phasing proposal (v3.0 → v3.1)

**v3.0 (MVP):**
1. Data model + IndexedDB migration.
2. `/decks/new` page + config panel + extraction reuse.
3. Flashcard generation pipeline + prompt + guardrail.
4. Deck overview + inline card editor.
5. `.apkg` + `.tsv` + `.csv` + PDF export.
6. SM-2-lite scheduler + review session UI.
7. Resume-deck: append flow + card dedup.

**v3.1 (refinement, out of scope for this plan):**
- FSRS scheduler as an opt-in alternative.
- Cross-device sync.
- Source-image reopen (requires v1.1 image persistence decision).
- Shared/public decks.

---

## Verification

- **Unit tests:** `src/lib/flashcard/sm2.test.ts` (each button transitions correctly across intervals/ease), `generate.test.ts` (prompt output validator rejects malformed JSON, enforces answer-token subset), `dedup.test.ts` (deletion-indices contract), export generators (round-trip a fixture deck through each format).
- **E2E (Playwright):** upload fixture screenshots on `/decks/new` → generate deck → open deck → export `.apkg` → import into a headless Anki check (or at minimum, unzip + schema spot-check the SQLite). Second flow: resume deck with more screenshots, verify dedup.
- **Manual in a browser:** full loop — create deck, review session, export each of the 4 formats, re-import `.apkg` into actual Anki to confirm compatibility. UI check on mobile for filmstrip + config panel.
- **Guardrail check:** run fidelity eval harness (`src/lib/eval/`) extended with a flashcard-answer subset check against a fixture source.
- **Cost check:** end-to-end batch of 20 screenshots, measure total AI spend vs. notes-only baseline to confirm flashcard pass is in the +20–40% range, not multiplicative.
