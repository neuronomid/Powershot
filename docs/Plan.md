# Powershot — Development Plan

**Version:** 1.0
**Date:** April 22, 2026
**Companion to:** [`PRD.md`](./PRD.md)

---

## Context

`PRD.md` defines *what* Powershot is and *what* v1 must do. This document defines *how* v1 gets built: a sequence of development phases, each of which ends at a demoable, testable milestone.

Note the distinction:
- PRD §12 lists **product phases** (v1 MVP / v2 Refinement / v3 Expansion).
- This plan lists **development phases** (the slicing of v1 itself).

### Guiding principles for the phase order

1. **De-risk unknowns early.** The AI pipeline (OpenRouter + Gemini vision) and Puppeteer on Vercel serverless are the two largest unknowns. Both are proven out before preview polish or theming.
2. **Each phase is a vertical slice.** Every phase ends with something a user (or reviewer) can actually use — not just internal scaffolding.
3. **Strict adherence to the PRD's hard constraints.** No paraphrasing, no invented content, zero server-side persistence of image or note data. These are load-bearing from Phase 2 onward.

### How to read a phase

Each phase has:
- **Goal** — one sentence on the outcome.
- **Scope (in)** — what gets built.
- **Scope (out)** — what's explicitly deferred to a later phase so this one can ship.
- **Deliverable** — the demoable state at the end.
- **Key risks** — what could go wrong and how we mitigate.
- **Depends on** — which earlier phases must be complete.

---

## Phase 0 — Foundation

**Goal:** A deployable Next.js skeleton with the design system and routing shell in place, ready to grow features into.

**Scope (in):**
- Next.js 15 (App Router) + TypeScript + Tailwind CSS + shadcn/ui primitives.
- Route shell: `/` (home), `/new` (new note), `/note/[id]` (preview).
- Base layout, typography tokens, color tokens, dark-mode toggle.
- Footer with privacy-policy link (page stub only).
- Environment wiring for `OPENROUTER_API_KEY` (server-side only) with local `.env.example`.
- Vercel project linked; main-branch auto-deploys.
- Minimal `README.md` with run instructions.

**Scope (out):** any upload, AI, or export logic.

**Deliverable:** `pnpm dev` boots a styled empty app; `main` auto-deploys to a Vercel preview URL.

**Key risks:**
- Misconfigured Node vs. Edge runtime defaults cause surprises later → document the runtime choice per route from day one.
- shadcn/ui version drift → pin the CLI version in `README.md`.

**Depends on:** nothing.

---

## Phase 1 — Upload & ordering (client-only)

**Goal:** A user can stage and reorder a batch of screenshots with no backend involvement.

**Scope (in):**
- Full-screen drag-and-drop zone on `/new` using `react-dropzone`.
- File picker (standard `<input type="file">`) and bulk selection.
- Clipboard paste (`Cmd+V` / `Ctrl+V`) anywhere on `/new`; pasted images get timestamp-based filenames.
- Client-side validation: PNG / JPG / JPEG / WebP / HEIC accepted, others rejected with inline error.
- Thumbnail grid with per-image remove (×) buttons.
- Order inference cascade:
  1. Filename regex matchers (macOS / Android / iOS / Windows / generic — see PRD Appendix A).
  2. EXIF `DateTimeOriginal` / `CreateDate` via `exifr`.
  3. `File.lastModified`.
  4. User insertion order.
- Confidence scoring on the inferred order; low-confidence banner when all fallbacks fail to disambiguate.
- Filmstrip reorder UI (top ~120 px canvas crop per image, filename + detected timestamp below).
- Drag-to-reorder and keyboard (arrow-key) reorder.
- "Reset to auto-detected" link.

**Scope (out):** any server round-trip; persistence to IndexedDB; editing pixel data.

**Deliverable:** the user selects a pile of screenshots and lands on a confirmed, ordered filmstrip. "Generate" button is present but does nothing yet.

**Key risks:**
- HEIC decode in-browser is inconsistent across browsers → render a neutral placeholder thumbnail when decode fails; do not block upload.
- EXIF stripped from screenshots on most platforms → the cascade must not get stuck; `lastModified` is the workhorse fallback.
- Drag-and-drop focus/keyboard parity is easy to forget → bake keyboard reorder in now rather than retrofitting in Phase 7.

**Depends on:** Phase 0.

---

## Phase 2 — Single-image extraction (de-risk the VLM path)

**Goal:** Prove the full pipe from browser → server → OpenRouter → Gemini 2.5 Pro → Markdown back, on one image.

**Scope (in):**
- `/api/extract` route (Node runtime on Vercel, because vision calls can exceed Edge's initial-response limit).
- OpenRouter client wrapper with typed request/response.
- Extraction prompt per PRD Appendix B. Hard rules enforced in the system message.
- Base64 inline image payload, one image per request.
- Retry with exponential backoff on transient failures (timeouts, 5xx).
- Fallback model chain: `google/gemini-2.5-pro` → `google/gemini-2.5-flash` → `anthropic/claude-haiku-4-5`.
- Minimal textarea-style preview on the client to display returned Markdown.

**Scope (out):** batch orchestration; dedup; review pass; streaming progress; rich preview; exports.

**Deliverable:** user uploads one screenshot on `/new`, clicks "Generate", and sees faithful Markdown rendered in a plain preview.

**Key risks:**
- Vercel 4.5 MB body limit → per-image requests stay well under; document the limit in the route handler.
- VLM invents or paraphrases despite instructions → token-subset guardrail is added in Phase 3 with the review pass; for now, eyeball on a handful of fixtures.
- OpenRouter rate-limit surprises at load → no load yet; revisit in Phase 3.

**Depends on:** Phase 0. (Phase 1 UI is nice-to-have here but not required — a temporary file input is enough.)

---

## Phase 3 — Batch pipeline: dedup + review + streamed progress

**Goal:** A full batch of screenshots is processed in parallel, deduplicated, reviewed, and streamed back to the client with per-image progress.

**Scope (in):**
- Client-side orchestrator with concurrency cap (~4 parallel extractions).
- Server-Sent Events stream of per-image status: `queued` → `extracting` → `reviewing` → `done` / `failed`.
- Progress panel UI on `/new` matching PRD §5.10 (icons per state, per-image retry on failure).
- Deterministic seam dedup: longest common suffix/prefix of adjacent chunks, normalized (whitespace-collapsed, case-insensitive), threshold ≥ 60 chars or ≥ 2 full lines.
- `/api/dedup` semantic pass via Gemini 2.5 Flash — returns **deletion spans only**, not rewrites.
- `/api/review` review pass via Gemini 2.5 Flash implementing PRD Appendix C prompt.
- Token-subset guardrail: the review endpoint also returns the set of output word tokens; backend verifies this is a subset of input tokens. Violations are logged and surfaced in the UI as a soft warning (flagged, not blocked).
- Ordering warnings from the review pass (`{after_chunk, before_chunk, reason}`) collected for Phase 4 to render.
- Per-chunk offset anchors recorded during extraction (which image produced which Markdown span), kept in memory for Phase 4's sync scroll.

**Scope (out):** the split-pane preview rendering; Tiptap editing; exports; theming.

**Deliverable:** a 10-image batch goes from upload → cleaned, deduplicated, reviewed Markdown with per-image progress and surfaced warnings, all visible in a plain scrollable view.

**Key risks:**
- Serverless timeout on large batches → orchestrator runs per-image calls from the client in parallel; OpenRouter routes use Node runtime with a 60 s budget.
- SSE through Vercel serverless can be finicky → keep the stream on a dedicated Node-runtime route if the Edge runtime misbehaves.
- Flash review pass silently rewrites content → token-subset guardrail catches this; fixture tests include known-clean inputs to confirm zero violations on the golden path.
- Dedup is too aggressive and deletes real content → threshold tuned on a small fixture set; user always sees the result in Phase 4's preview before exporting.

**Depends on:** Phase 2.

---

## Phase 4 — Preview & editing

**Goal:** The user can review the generated note against its source images and make inline corrections.

**Scope (in):**
- `/note/[id]` split-pane preview layout.
- **Left pane:** source images in a scrollable column, in their final order.
- **Right pane:** Tiptap editor configured to read and output Markdown (via a Markdown extension or `tiptap-markdown`).
- Synchronized scroll: scrolling either pane scrolls the other to the corresponding chunk, using the per-chunk offset anchors from Phase 3.
- Inline rendering of ordering warnings from the review pass ("Screenshots 4 and 5 may be out of order") near the relevant chunk.
- "Revert to extracted" button restores the original review output; local edits tracked in component state.
- In-memory "note" shape (title, ordered images, chunks with anchors, current Markdown, warnings, preferences) ready for the export step.

**Scope (out):** the export button actually producing files; theming UI; persistence to IndexedDB.

**Deliverable:** the user reviews a generated note side-by-side with sources, edits Markdown inline, and reverts if they want.

**Key risks:**
- Tiptap round-tripping Markdown loses subtle formatting (especially GFM tables) → pick a Markdown extension that round-trips GFM faithfully; add fixture tests for tables and nested lists.
- Sync scroll fights the user during editing → disable sync while the editor has focus; re-enable on blur or explicit toggle.

**Depends on:** Phase 3.

---

## Phase 5 — Export & theming

**Goal:** The user downloads a polished PDF and DOCX with their chosen theme, fonts, and sizes.

**Scope (in):**
- Markdown → HTML pipeline: `remark` + `remark-gfm` + `rehype-stringify`.
- `/api/export?format=pdf` — Node runtime, `puppeteer-core` + `@sparticuz/chromium`, renders themed HTML and returns a PDF stream.
- `/api/export?format=docx` — generates DOCX via the `docx` library with Word-native heading styles (Heading 1–6), real bulleted/numbered lists, and real tables (not images), preserving bold/italic.
- Theme panel on `/note/[id]`:
  - Presets: Classic, Modern, Sepia, Minimal.
  - Body font picker (Inter, IBM Plex Sans, Georgia, Merriweather, Source Serif, JetBrains Mono).
  - Heading font picker (same list, independent).
  - Base size: Small (10 pt), Medium (11 pt), Large (12 pt), X-Large (14 pt); heading sizes scale proportionally.
  - Line spacing: 1.15 / 1.5 / 2.0.
- Preferences persisted to `localStorage`.
- Fallback path: if Puppeteer fails on a given request, convert DOCX → PDF via a lightweight converter so the user still gets a PDF.

**Scope (out):** dark-themed PDF/DOCX exports (explicitly not a v1 goal per PRD §7); note history; continue-note.

**Deliverable:** user clicks "Download PDF" / "Download DOCX" and gets a correctly themed, structurally faithful file with working outline navigation in Word.

**Key risks:**
- Puppeteer on Vercel is known-fragile → use the well-maintained `@sparticuz/chromium`, keep the route on Node runtime with extended timeout, and have the DOCX→PDF fallback ready.
- DOCX tables with merged cells degrade → acceptable for v1 per PRD §11; surface a soft warning in the UI when merged cells are detected upstream.
- Fonts not embedded in PDF → bundle the curated font list as web fonts, embedded via the themed HTML before Puppeteer prints.

**Depends on:** Phase 4.

---

## Phase 6 — Local history & continue-note

**Goal:** Notes persist across sessions on the user's device, and the user can append new screenshots to an existing note.

**Scope (in):**
- IndexedDB store via `idb`: notes keyed by id, storing `{ title, createdAt, updatedAt, markdown, preferences, chunkAnchors }`.
- Home screen `/` lists recent notes by title + date, with a "New" CTA.
- "Continue this note" flow: opens the stored note's Markdown in `/note/[id]`, and the "Add screenshots" action runs the Phase 3 pipeline on the new batch and appends the cleaned Markdown to the end, preserving the user's theme preferences.
- Saved preferences re-applied on open.

**Scope (out):** persisting source images (deferred to v1.1 per PRD §11); server-side persistence; sharing.

**Deliverable:** user creates a note, closes the tab, returns later, and resumes — including adding more screenshots to it.

**Key risks:**
- IndexedDB quota exhaustion for users with many long notes → surface a friendly error and a "delete oldest" prompt.
- Schema migration pain if we change the note shape post-launch → version the stored records from the start.

**Depends on:** Phase 5.

---

## Phase 7 — Polish, a11y, performance, launch

**Goal:** v1 is shippable: accessible, performant, privacy-clear, and instrumented enough to measure the PRD's success metrics.

**Scope (in):**
- WCAG AA audit: focus order, ARIA on the filmstrip and progress panel, color contrast on all themes.
- Verify keyboard parity across upload, reorder, preview, and export (arrow-key reorder was already baked in Phase 1 — now confirm it end-to-end).
- Micro-interactions: spring physics on drop, skeleton shimmer during extraction, per-image checkmark animation on completion, smooth drag animations on reorder.
- Performance pass to hit the PRD target: 20-screenshot note end-to-end < 60 s on typical broadband. Concurrency cap tuning, payload shape tweaks, Edge-vs-Node runtime check per route.
- Dark-mode UI audited and polished (exports remain light-themed per PRD §7).
- Privacy policy page (content, not just the link stub from Phase 0), stating zero server-side persistence of image or note data.
- Success-metric instrumentation hooks:
  - Extraction fidelity benchmark harness (runs the 50-note eval set offline; not a live telemetry hook).
  - Ordering accuracy harness (runs the 100-batch ordering eval offline).
  - Time-to-export measurement in the UI (client-side timer, shown to the user and logged to a local debug panel).
- README with setup, deploy, and eval-harness instructions. Deploy runbook for Vercel (env vars, runtime choices per route, Puppeteer-on-Vercel gotchas).

**Scope (out):** accounts, cloud sync, multilingual, handwriting, mobile PWA, shareable links (all v2/v3).

**Deliverable:** a v1 that passes the PRD §8 non-functional requirements and is ready to share with real users.

**Key risks:**
- Late-breaking a11y issues that require structural refactors → mitigated by baking keyboard reorder and focus discipline in from Phases 1 and 3.
- Eval harnesses slip because the benchmark sets aren't assembled → start assembling fixtures opportunistically from Phase 2 onward.

**Depends on:** Phases 0–6.

---

## Deferred (post-MVP)

These come from PRD §12 and are explicitly out of scope for this plan:

- **v2 — Refinement:** user accounts, cloud-synced note history, image persistence for continue-note, shareable read-only note links.
- **v3 — Expansion:** multilingual support (Spanish, French, German), handwriting recognition, mobile PWA with native-like camera capture, browser extension for one-click capture.

When any of these promote to active work, a follow-up plan document will slice them the same way this one slices v1.
