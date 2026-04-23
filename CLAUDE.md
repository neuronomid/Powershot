# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Powershot is

A web app that turns a batch of screenshots into a clean, structured Markdown note exportable as PDF and DOCX. The pipeline is:

1. Client-side upload + order inference (filename regex → EXIF → `File.lastModified` → insertion order).
2. Per-image extraction via OpenRouter → Gemini 2.5 Pro (vision), one image per serverless call.
3. Two-stage dedup of overlapping seams (deterministic longest-common-suffix/prefix, then a Gemini 2.5 Flash semantic pass that returns **deletion spans only**).
4. Flash review pass that may rearrange/regroup/rejoin but must not reword.
5. Tiptap split-pane preview with sync scroll; user edits Markdown inline.
6. Export: PDF via `puppeteer-core` + `@sparticuz/chromium`; DOCX via the `docx` library.

## Current state

Phases 0–6 are implemented and shipping. Phase 7 (a11y, perf, eval harnesses, launch polish) is in progress. The v2 roadmap lives in `docs/PRD2.md` and `docs/Plan2.md` — treat those as planning docs, not specs of current behavior. `docs/PRD.md` and `docs/Plan.md` remain the sources of truth for v1 behavior and the dev-phase slicing.

`docs/Plan.md` explicitly distinguishes **product phases** (PRD §12: v1 / v2 / v3) from **development phases** (the slicing of v1 itself into 0–7) — don't conflate them.

## Commands

Package manager is **pnpm**. Node 20+.

| command | purpose |
|---|---|
| `pnpm dev` | Turbopack dev server on http://localhost:3000 |
| `pnpm build` / `pnpm start` | production build / run |
| `pnpm lint` | ESLint (`eslint.config.mjs`, Next core-web-vitals + TS) |
| `pnpm test` | Vitest (jsdom, `src/**/*.{test,spec}.{ts,tsx}`) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright (`tests/e2e`, Chromium, auto-starts dev server on 127.0.0.1) |
| `pnpm test:all` | Vitest then Playwright |

Run a single Vitest file: `pnpm test src/lib/upload/order-inference.test.ts`. Filter by name: `pnpm test -t "<pattern>"`.
Run a single Playwright test: `pnpm test:e2e -g "<pattern>"`.

Setup: `pnpm install`, `cp .env.example .env.local`, add `OPENROUTER_API_KEY`.

## Load-bearing constraints

These shape the whole codebase. Violating them is never a local fix — it changes the product.

- **No paraphrasing, no invented content.** Every prompt (extraction, dedup, review) forbids adding/removing/rewording user-visible text. The review endpoint enforces a **token-subset guardrail**: the model returns the set of output word tokens, and the server verifies it is a subset of input tokens. Violations are logged and surfaced as a soft warning — flagged, not blocked.
- **Zero server-side persistence of image or note data.** Images live in memory and in transit only. No disk writes, no Vercel Blob, no logs containing image bytes or extracted text. Notes live client-side: `IndexedDB` via `idb` for notes (`src/lib/note/db.ts`, `store.ts`), `localStorage` for preferences.
- **Per-image serverless calls.** One image per extraction request to stay under Vercel's ~4.5 MB body limit and to allow per-image streaming progress. Client orchestrates with a concurrency cap of ~4 (`src/lib/pipeline/batch.ts`, `useBatchPipeline.ts`). No single server call should exceed ~30 s.
- **Fallback model chain** configured in OpenRouter: `google/gemini-2.5-pro` → `google/gemini-2.5-flash` → `anthropic/claude-haiku-4-5`. Central wrapper: `src/lib/ai/openrouter.ts`; prompts: `src/lib/ai/prompts.ts`.
- **Runtime is per-route and deliberate.** Each API route declares `export const runtime` at the top. Node for the three OpenRouter-backed AI routes and export (`maxDuration = 60`); Edge for lightweight donation proxy routes. The AI routes use Node because Vercel Edge stops requests that do not return an initial response within 25 s. Don't change a runtime without a reason.
- **`OPENROUTER_API_KEY` is server-side only.** Never prefix with `NEXT_PUBLIC_`.
- **Source images are not persisted in v1.** The continue-note flow appends new Markdown; it does not re-open old source images. This is deferred to v1.1 per PRD §11.

## Architecture map

Single Next.js 16 App Router app (not a monorepo). React 19, TypeScript strict, Tailwind v4 (`@tailwindcss/postcss`, global CSS `src/app/globals.css`), shadcn/ui in `radix-nova` style with `lucide` icons (`components.json`). Path alias `@/*` → `src/*`.

Routes:

| path | purpose |
|---|---|
| `/` | home, recent-notes list |
| `/new` | upload + order + generate |
| `/note/[id]` | split-pane preview, edit, export, theme |
| `/privacy` | full privacy policy |
| `/donate` | crypto donation (v2 addition) |

API routes (all under `src/app/api/*/route.ts`):

| path | runtime | purpose |
|---|---|---|
| `POST /api/extract` | Node | one image → Markdown |
| `POST /api/dedup` | Node | semantic dedup (Flash), returns deletion spans only |
| `POST /api/review` | Node | review pass (Flash), returns revised Markdown + ordering warnings + output-token set for guardrail |
| `POST /api/export` | Node | PDF (Puppeteer) / DOCX; includes DOCX→PDF fallback if Puppeteer fails |
| `POST /api/donate` | — | donation flow (v2) |

Library layout under `src/lib/`:

- `ai/` — OpenRouter client + all prompts.
- `upload/` — file validation, filename-timestamp parsing, order inference cascade, image resize. Pure functions with colocated `*.test.ts`.
- `pipeline/` — batch orchestration and the `useBatchPipeline` React hook (client-side concurrency cap).
- `dedup/` — deterministic longest-common-suffix/prefix dedup (stage 1 of the two-stage dedup).
- `note/` — IndexedDB persistence (`idb`), note store, types.
- `export/` — Markdown → themed HTML (for Puppeteer) and Markdown → DOCX.
- `theme/` — preset definitions and localStorage persistence.
- `eval/` — offline `fidelity-harness` (token-overlap) and `ordering-harness` (Kendall-tau + exact-position). Run via Vitest or a standalone script.

Component layout under `src/components/`: `upload/`, `pipeline/`, `preview/`, `donate/`, plus shadcn primitives in `ui/`. Top-level pieces: `site-header`, `site-footer`, `theme-provider`, `theme-toggle`, `error-boundary`, `debug-panel`, `terms-acceptance`.

## Phase discipline (when adding features)

The Plan slices v1 into vertical, demoable phases. Don't skip ahead — Phase N assumes N-1 is real. Key pre-baked decisions that aren't meant to be retrofitted:

- Phase 2 (single-image extraction) is the VLM de-risk; keep it decoupled from batch/dedup/review.
- Phase 3 ships the review endpoint together with the token-subset guardrail — they're a pair.
- Keyboard-reorder parity on the filmstrip was baked in at Phase 1.

## Deploy

Vercel; `main` auto-deploys. Set `OPENROUTER_API_KEY` in Project Settings. `/api/extract`, `/api/dedup`, `/api/review`, and `/api/export` must remain Node runtime with a 60s max duration.

## Sources of truth

| file | what it decides |
|---|---|
| `docs/PRD.md` | v1 product spec |
| `docs/Plan.md` | v1 development phases (0–7) |
| `docs/PRD2.md`, `docs/Plan2.md` | v2 roadmap — planning, not current behavior |
| `AGENTS.md` | Compact guidance (OpenCode-oriented), overlaps with this file |
| `package.json` | exact deps and scripts |
| `components.json` | shadcn config |
