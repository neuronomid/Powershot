# AGENTS.md — Powershot

Compact guidance for OpenCode sessions. When in doubt, trust executable config over prose.

## Current state

- **Phases 0–6 complete.** Upload, ordering, extraction, dedup, review, preview, editing, export, theming, local history, continue-note all implemented.
- **Phase 7 (polish, a11y, performance, launch) in progress.**

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install deps (**pnpm** required, Node 20+) |
| `pnpm dev` | Turbopack dev server on http://localhost:3000 |
| `pnpm build` | Production build (also serves as typecheck — no separate `typecheck` script) |
| `pnpm start` | Run production build locally |
| `pnpm lint` | ESLint (`eslint.config.mjs`, core-web-vitals + typescript) |
| `pnpm test` | Vitest (jsdom, `src/**/*.{test,spec}.{ts,tsx}`) |
| `pnpm test:watch` | Vitest watch mode |
| `pnpm test:e2e` | Playwright (`tests/e2e/`, Chromium, auto-starts dev server on 127.0.0.1:3000) |
| `pnpm test:all` | Vitest then Playwright |

Run a single Vitest file: `pnpm test src/lib/upload/order-inference.test.ts`
Filter by test name: `pnpm test -t "<pattern>"`
Run a single Playwright test: `pnpm test:e2e -g "<pattern>"`

## Setup

```bash
pnpm install
cp .env.example .env.local   # add required keys
pnpm dev
```

Env vars (see `.env.example`):
- `OPENROUTER_API_KEY` — server-only, required for extraction/dedup/review
- `NOWPAYMENTS_API_KEY` — server-only, for donate API
- `NOWPAYMENTS_IPN_SECRET` — server-only, for donate IPN verification
- `NEXT_PUBLIC_PAYPAL_DONATE_URL` — client-safe, PayPal donate link

## Architecture

Single Next.js 16 App Router app (not a monorepo). React 19, TypeScript strict, Tailwind v4 (`@tailwindcss/postcss`), shadcn/ui (`radix-nova` style, `lucide` icons). Path alias `@/*` → `src/*`.

### Pages

| Route | Purpose |
|-------|---------|
| `/` | Home, recent-notes list |
| `/new` | Upload + order + generate |
| `/note/[id]` | Split-pane preview, edit, export |
| `/privacy` | Privacy policy |
| `/donate` | Crypto donation (v2 addition) |

### API routes (`src/app/api/*/route.ts`)

| Path | Runtime | Purpose |
|------|---------|---------|
| `POST /api/extract` | Edge | Single-image VLM extraction |
| `POST /api/dedup` | Edge | Semantic dedup (Flash) |
| `POST /api/review` | Edge | Review + token-subset guardrail |
| `POST /api/export` | Node | PDF (Puppeteer, `maxDuration=60`) / DOCX |
| `POST /api/donate/*` | — | Donation flow (5 routes under `/api/donate/`) |

### Library layout (`src/lib/`)

- `ai/` — OpenRouter client + all prompts
- `upload/` — File validation, filename-timestamp parsing, order inference, image resize. Pure functions with colocated `*.test.ts`
- `pipeline/` — Batch orchestration, `useBatchPipeline` hook (client-side concurrency cap ~4)
- `dedup/` — Deterministic longest-common-suffix/prefix (stage 1)
- `note/` — IndexedDB persistence (`idb`), note store, types
- `export/` — Markdown → themed HTML (Puppeteer), Markdown → DOCX
- `theme/` — Preset definitions + localStorage persistence
- `donate/` — Donation data types and helpers
- `eval/` — Offline fidelity-harness (token-overlap) + ordering-harness (Kendall-tau). Run via Vitest or standalone script.

### Component layout (`src/components/`)

`upload/`, `pipeline/`, `preview/`, `donate/`, plus shadcn primitives in `ui/`. Top-level: `site-header`, `site-footer`, `theme-provider`, `theme-toggle`, `error-boundary`, `debug-panel`, `terms-acceptance`.

## Load-bearing constraints (never violate locally)

These are product-defining. Read `CLAUDE.md` §"Load-bearing constraints" for full rationale.

1. **No paraphrasing or invented content.** Every prompt must forbid adding/removing/rewording user-visible text. Review endpoint enforces a **token-subset guardrail**.
2. **Zero server-side persistence of image or note data.** Images in memory and transit only. No disk writes, no Vercel Blob, no logs with image bytes or extracted text. Notes client-side (IndexedDB + localStorage).
3. **Per-image serverless calls.** One image per extraction request. Client orchestrates with concurrency cap ~4. No single call exceeds ~30 s.
4. **Fallback model chain**: `google/gemini-2.5-pro` → `google/gemini-2.5-flash` → `anthropic/claude-haiku-4-5`.
5. **Runtime is per-route and deliberate.** Edge for AI routes; Node for export (Puppeteer requires it). Each route declares `export const runtime` at the top. Don't change a runtime without a reason.
6. **`OPENROUTER_API_KEY` is server-side only.** Never prefix with `NEXT_PUBLIC_`. Same for `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`.
7. **Source images not persisted in v1.** Continue-note appends new Markdown; does not re-open old images. Deferred to v1.1.

## Sources of truth

| File | What it decides |
|------|-----------------|
| `docs/PRD.md` | v1 product spec |
| `docs/Plan.md` | v1 dev phases (0–7). Distinguishes product phases (v1/v2/v3) from dev phases |
| `docs/PRD2.md`, `docs/Plan2.md` | v2 roadmap — planning docs, not current behavior |
| `CLAUDE.md` | Detailed constraints, stack, route rationale. Read before non-trivial changes |
| `package.json` | Exact deps and scripts |
| `components.json` | shadcn config (`radix-nova`, `lucide`, RSC, TSX) |

## Style / toolchain quirks

- **Tailwind v4** with `@tailwindcss/postcss`. Global CSS is `src/app/globals.css`. No `tailwind.config.*` file.
- **shadcn/ui** components in `src/components/ui/`. Add via `npx shadcn add <component>`.
- **Vitest** setup: jsdom env, `restoreMocks: true`, setup file `vitest.setup.ts`. Test files colocated as `*.test.ts(x)` in `src/`.
- **Playwright** runs Chromium only, auto-starts dev server. Config in `playwright.config.ts`.
- **No CI or pre-commit hooks.** No separate typecheck script — `pnpm build` catches type errors.
- **Deploy:** Vercel, `main` auto-deploys. `/api/export` must stay Node runtime with 60 s max duration for Puppeteer.