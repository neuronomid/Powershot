# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

This repo currently contains **only planning documents** — no code, no `package.json`, no build tooling yet. The two source-of-truth documents are:

- `docs/PRD.md` — what Powershot is and what v1 must do.
- `docs/Plan.md` — how v1 gets built, sliced into Phases 0–7.

Before making non-trivial product changes, read both. `docs/Plan.md` explicitly distinguishes **product phases** (PRD §12: v1 / v2 / v3) from **development phases** (the slicing of v1 itself in Plan.md) — don't conflate them.

## What Powershot is

A web app that turns a batch of screenshots into a clean, structured Markdown note exportable as PDF and DOCX. The pipeline is:

1. Client-side upload + order inference (filename regex → EXIF → `File.lastModified` → insertion order).
2. Per-image extraction via OpenRouter → Gemini 2.5 Pro (vision), one image per serverless call.
3. Two-stage dedup of overlapping seams (deterministic longest-common-suffix/prefix, then a Gemini 2.5 Flash semantic pass that returns **deletion spans only**).
4. Flash review pass that may rearrange/regroup/rejoin but must not reword.
5. Tiptap split-pane preview with sync scroll; user edits Markdown inline.
6. Export: PDF via `puppeteer-core` + `@sparticuz/chromium`; DOCX via the `docx` library.

## Load-bearing constraints

These are the constraints that shape the whole codebase. Violating them is never a local fix — it changes the product.

- **No paraphrasing, no invented content.** Every prompt (extraction, dedup, review) forbids adding/removing/rewording user-visible text. The review endpoint enforces a **token-subset guardrail**: the model returns the set of output word tokens, and the server verifies it is a subset of input tokens. Violations are logged and surfaced as a soft warning — flagged, not blocked.
- **Zero server-side persistence of image or note data.** Images live in memory and in transit only. No disk writes, no Vercel Blob, no logs containing image bytes or extracted text. Note Markdown is stored in the user's browser (`IndexedDB` via `idb` for notes, `localStorage` for preferences).
- **Per-image serverless calls.** Each extraction is one image per request to stay under Vercel's 4.5 MB body limit and to allow per-image streaming progress. Orchestration happens on the client with a concurrency cap of ~4. No single server function call should exceed ~30 s.
- **Fallback model chain** configured in OpenRouter: `google/gemini-2.5-pro` → `google/gemini-2.5-flash` → `anthropic/claude-haiku-4-5`.
- **Runtime choice is per-route and deliberate.** Edge runtime where possible for lower latency; Node runtime where required (Puppeteer export, and SSE if Edge misbehaves). Document the runtime at the top of every route handler.

## Planned stack (not yet installed)

When scaffolding, match what the PRD and Plan specify — don't substitute equivalents without a reason:

- Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui.
- `react-dropzone` (uploads), `exifr` (EXIF), Tiptap + a GFM-faithful Markdown extension (editor), `idb` (IndexedDB), `docx` (DOCX export), `puppeteer-core` + `@sparticuz/chromium` (PDF), `remark` + `remark-gfm` + `rehype-stringify` (Markdown → HTML).
- AI via OpenRouter. `OPENROUTER_API_KEY` is server-side only; wire it through `.env.example` from Phase 0.
- Hosting: Vercel. `main` auto-deploys.
- Package manager: `pnpm` (the Plan's deliverable for Phase 0 is `pnpm dev`).

## Route shell

- `/` — home, recent-notes list.
- `/new` — upload + order + generate.
- `/note/[id]` — split-pane preview + theme + export.

API routes (per Plan):

- `POST /api/extract` — one image → Markdown (Edge runtime preferred).
- `POST /api/dedup` — semantic dedup pass (Flash), returns deletion spans only.
- `POST /api/review` — review pass (Flash), returns revised Markdown + ordering warnings + output-token set for the guardrail.
- `GET /api/export?format=pdf|docx` — Node runtime; extended timeout; DOCX→PDF fallback path if Puppeteer fails.

## How to proceed when asked to build

The Plan is written so each phase is a **vertical slice** ending in a demoable state. Don't skip ahead — Phase N assumes Phase N-1's deliverable is real. In particular:

- Phase 2 (single-image extraction) is the VLM de-risk; don't couple it to batch/dedup/review work.
- The token-subset guardrail ships with the review endpoint in Phase 3, not later.
- Keyboard-reorder parity on the filmstrip is baked in at Phase 1, not retrofitted at Phase 7.
- Source images are **not** persisted in v1 (deferred to v1.1 per PRD §11). The continue-note flow appends new Markdown; it does not re-open old source images.

## Commands

No build/test/lint commands exist yet — the repo has no `package.json`. Once Phase 0 lands, this section should document `pnpm dev`, `pnpm build`, `pnpm test`, and how to run a single test, along with the offline eval harnesses planned in Phase 7 (50-note extraction-fidelity benchmark, 100-batch ordering-accuracy benchmark).
