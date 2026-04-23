# Powershot

Turn a stack of screenshots into a clean, structured, downloadable note (PDF + DOCX), without paraphrasing or inventing content.

See [`docs/PRD.md`](./docs/PRD.md) for the product spec and [`docs/Plan.md`](./docs/Plan.md) for the development phases.

## Current status

**Phase 7 — Polish, a11y, performance, launch is in progress.** All core features (upload, ordering, extraction, dedup, review, preview, editing, export, theming, local history, continue-note) are implemented. This phase focuses on accessibility audits, micro-interactions, performance tuning, privacy policy, eval harnesses, and launch readiness.

## Prerequisites

- Node.js 20+ (tested on 25).
- pnpm 10+ (`corepack enable pnpm` if you don't have it).

## Local development

```bash
pnpm install
cp .env.example .env.local   # add OPENROUTER_API_KEY for extraction to work
pnpm dev
```

App runs at http://localhost:3000.

## Scripts

| command         | what it does                                  |
| --------------- | --------------------------------------------- |
| `pnpm dev`      | start the Turbopack dev server                |
| `pnpm build`    | production build                              |
| `pnpm start`    | run the production build locally              |
| `pnpm lint`     | ESLint across the project                     |
| `pnpm test`     | Vitest unit/component tests                   |
| `pnpm test:e2e` | Playwright browser tests                      |
| `pnpm test:all` | Vitest followed by Playwright                 |

## Routes

| path           | status  | purpose                                |
| -------------- | ------- | -------------------------------------- |
| `/`            | active  | home, recent-notes list (Phase 6)      |
| `/new`         | active  | upload + ordering + generation UI      |
| `/note/[id]`   | active  | split-pane preview + editing + export  |
| `/privacy`     | active  | full privacy policy (Phase 7)          |

API routes:

| path              | runtime | purpose                          |
| ----------------- | ------- | -------------------------------- |
| `POST /api/extract`   | Node  | single-image VLM extraction      |
| `POST /api/dedup`     | Node  | semantic dedup pass              |
| `POST /api/review`    | Node  | review + token-subset guardrail  |
| `POST /api/export`    | Node  | PDF (Puppeteer) / DOCX export    |

## Environment

`OPENROUTER_API_KEY` — **server-side only**, never prefixed with `NEXT_PUBLIC_`. Required for extraction, dedup, and review endpoints.

## Deploy

Hosted on Vercel. `main` auto-deploys.

### Vercel setup checklist

1. Set `OPENROUTER_API_KEY` in Project Settings → Environment Variables.
2. Ensure `/api/extract`, `/api/dedup`, `/api/review`, and `/api/export` stay on Node runtime with 60 s max duration. OpenRouter calls can exceed Vercel Edge's 25 s initial-response limit.
3. For Puppeteer on Vercel, ensure the `@sparticuz/chromium` package is installed.
4. No additional build settings are required; Next.js builds out of the box.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix base), next-themes for dark mode.

## Eval harnesses

Offline benchmark harnesses live in `src/lib/eval/`:

- **`fidelity-harness.ts`** — token-overlap scoring for extraction accuracy against a ground-truth reference set.
- **`ordering-harness.ts`** — Kendall-tau and exact-position accuracy for the order-inference cascade.

These are designed to run in Vitest or a standalone Node script, not as live telemetry.

Example usage in a test file:

```ts
import { runFidelityHarness } from "@/lib/eval/fidelity-harness";

const results = runFidelityHarness([
  {
    id: "fixture-1",
    name: "Simple paragraph",
    referenceMarkdown: "Hello world",
    extractedMarkdown: "Hello world",
  },
]);

console.log(results.averageF1);
```

## Privacy

Powershot stores nothing on our servers. Images are processed in memory and in transit only. Notes and preferences live in your browser (IndexedDB + localStorage). See the full policy at `/privacy`.
