# AGENTS.md — Powershot

Compact guidance for OpenCode sessions working in this repo. When in doubt, trust executable config over prose.

## Current state

- **Phase 0 (foundation) is complete.** Next.js 16 skeleton, design tokens, route shell, shadcn/ui wired.
- **Phase 1 (upload + ordering) is in progress.** `/new` has drag-drop/paste, thumbnail grid, filmstrip with drag + keyboard reorder, and order inference. Generate button is stubbed.
- **No AI, dedup, review, export, or persistence logic yet.** Those land in Phases 2–6.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install deps (package manager: **pnpm**). |
| `pnpm dev` | Turbopack dev server on http://localhost:3000. |
| `pnpm build` | Production build. |
| `pnpm start` | Run production build locally. |
| `pnpm lint` | ESLint (Next.js core-web-vitals + typescript configs). |

> No test runner or typecheck script exists yet. The Plan says eval harnesses land in Phase 7.

## Setup

```bash
pnpm install
cp .env.example .env.local   # leave OPENROUTER_API_KEY blank until Phase 2
pnpm dev
```

## Architecture

- **Single Next.js app** (App Router), not a monorepo.
- **Next.js 16** (Plan targets 15; 16 is current stable and backward-compatible for the patterns we use).
- **React 19, TypeScript, Tailwind CSS v4, shadcn/ui** (`radix-nova` style, `lucide` icons).
- **Path alias:** `@/*` maps to `src/*`.

### Routes (status)

| Route | Status | Purpose |
|-------|--------|---------|
| `/` | stub | Home / recent notes (Phase 6) |
| `/new` | active UI | Upload + order (Phase 1); generate stubbed |
| `/note/[id]` | stub | Preview + export (Phases 4–5) |
| `/privacy` | stub | Policy copy (Phase 7) |

API routes: none yet. Planned: `POST /api/extract`, `/api/dedup`, `/api/review`, `GET /api/export`.

## Load-bearing constraints (never violate locally)

These are product-defining, not style preferences. Read `CLAUDE.md` §"Load-bearing constraints" for full rationale.

1. **No paraphrasing or invented content.** Every prompt must forbid adding/removing/rewording user-visible text. The review endpoint (Phase 3) enforces a **token-subset guardrail**.
2. **Zero server-side persistence of image or note data.** Images live in memory and in transit only. No disk writes, no Vercel Blob, no logs with image bytes or extracted text. Note Markdown is stored client-side (`IndexedDB` for notes, `localStorage` for preferences).
3. **Per-image serverless calls.** One image per extraction request to stay under Vercel's ~4.5 MB body limit and to allow per-image streaming progress. Client orchestration with concurrency cap ~4. No single server call should exceed ~30 s.
4. **Fallback model chain** in OpenRouter: `google/gemini-2.5-pro` → `google/gemini-2.5-flash` → `anthropic/claude-haiku-4-5`.
5. **Runtime choice is per-route and deliberate.** Edge runtime where possible; Node runtime where required (Puppeteer export, SSE if Edge misbehaves). Document the runtime at the top of every route handler.
6. **`OPENROUTER_API_KEY` is server-side only.** Never prefix with `NEXT_PUBLIC_`.

## Phase discipline

The Plan slices v1 into vertical phases (0–7). **Do not skip ahead.** Phase N assumes Phase N-1 is real and demoable.

- **Phase 2** = single-image extraction (VLM de-risk). Don't couple it to batch/dedup/review work.
- **Phase 3** = batch orchestration + dedup + review + token-subset guardrail. This is when the guardrail ships.
- **Phase 4** = split-pane preview + Tiptap editing.
- **Phase 5** = PDF/DOCX export.
- **Phase 6** = IndexedDB persistence + continue-note.
- **Phase 7** = a11y, perf, eval harnesses, polish.

Key pre-baked decisions you can't retrofit:
- Keyboard reorder parity on the filmstrip → baked in Phase 1 (already present).
- Source images **not** persisted in v1 (deferred to v1.1). The continue-note flow appends new Markdown; it does not re-open old source images.

## Sources of truth

| File | What it decides |
|------|-----------------|
| `docs/PRD.md` | Product spec: what v1 must do. |
| `docs/Plan.md` | Development phases: how v1 gets built. Distinguishes product phases (v1/v2/v3) from dev phases (0–7). |
| `CLAUDE.md` | Detailed constraints, stack, route shell, and rationale. Read before non-trivial changes. |
| `package.json` | Exact deps and scripts. |
| `components.json` | shadcn/ui config (`radix-nova`, `lucide`, RSC, TSX). |

## Style / toolchain quirks

- **Tailwind v4** with `@tailwindcss/postcss`. Global CSS is `src/app/globals.css`.
- **shadcn/ui** components live in `src/components/ui/`. Add new ones via the shadcn CLI (`npx shadcn add <component>`), respecting the `radix-nova` style.
- **ESLint config** is `eslint.config.mjs` using `eslint-config-next/core-web-vitals` + `typescript`.
- **No CI or pre-commit hooks** yet.
- Hosting: Vercel; `main` auto-deploys.
