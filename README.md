# Powershot

Turn a stack of screenshots into a clean, structured, downloadable note (PDF + DOCX), without paraphrasing or inventing content.

See [`docs/PRD.md`](./docs/PRD.md) for the product spec and [`docs/Plan.md`](./docs/Plan.md) for the development phases.

## Current status

**Phase 0 — Foundation.** Next.js skeleton, design tokens, route shell. No upload, AI, or export logic yet.

## Prerequisites

- Node.js 20+ (tested on 25).
- pnpm 10+ (`corepack enable pnpm` if you don't have it).

## Local development

```bash
pnpm install
cp .env.example .env.local   # leave OPENROUTER_API_KEY blank until Phase 2
pnpm dev
```

App runs at http://localhost:3000.

## Scripts

| command        | what it does                                  |
| -------------- | --------------------------------------------- |
| `pnpm dev`     | start the Turbopack dev server                |
| `pnpm build`   | production build                              |
| `pnpm start`   | run the production build locally              |
| `pnpm lint`    | ESLint across the project                     |

## Routes

| path           | status  | purpose                                |
| -------------- | ------- | -------------------------------------- |
| `/`            | stub    | home, recent-notes list (Phase 6)      |
| `/new`         | stub    | upload + order + generate (Phases 1–3) |
| `/note/[id]`   | stub    | split-pane preview + export (Phase 4–5) |
| `/privacy`     | stub    | full copy lands in Phase 7             |

API routes land starting Phase 2 (`/api/extract`), with `/api/dedup`, `/api/review`, and `/api/export` following. Runtime choice (Edge vs Node) is documented at the top of each handler.

## Environment

`OPENROUTER_API_KEY` — **server-side only**, never prefixed with `NEXT_PUBLIC_`. Required from Phase 2 onward.

## Deploy

Hosted on Vercel. `main` auto-deploys. Set `OPENROUTER_API_KEY` in the Vercel project settings once the API routes land.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix base), next-themes for dark mode.

> Note: the Plan targets Next.js 15, but Next.js 16 is the current stable as of project start and is fully backwards-compatible with the App Router patterns the Plan specifies.
