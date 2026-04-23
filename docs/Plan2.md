# Powershot v2 — Development Plan

**Version:** 2.0
**Date:** April 23, 2026
**Companion to:** [`PRD2.md`](./PRD2.md) (v2 PRD), [`Plan.md`](./Plan.md) (v1 plan)

---

## Context

`PRD2.md` defines *what* Powershot v2 must do. This plan defines *how* v2 gets built: a sequence of development phases (8–13), each ending at a demoable, testable milestone. Phases 8–13 build on the completed Phases 0–7 from `Plan.md`.

### Guiding principles (unchanged from v1)

1. **De-risk unknowns early.** New integrations (PDF, browser extension, Service Worker) are proven before polish.
2. **Each phase is a vertical slice.** Every phase ends with something a user can actually use.
3. **Strict adherence to privacy constraints.** No new server-side persistence of images or note data. The browser extension sends images client-side, not through a separate server.

### Phase numbering

Phases 8–13 continue from the completed Phases 0–7 in `Plan.md`. Phase N depends on Phase N-1 being complete and demoable.

---

## Phase 8 — Production hardening & editor fundamentals

**Goal:** The app is safe to share publicly; core editor UX matches professional expectations.

**Scope (in):**
- **Rate limiting** (PRD2 §3.19): Per-IP rate limiting on all API routes using Vercel Edge Config + KV (or in-memory for single-instance). Configurable limits per route. `429` responses with `Retry-After` header.
- **Request-size validation**: Reject request bodies > 5 MB at the Edge level.
- **Image count cap**: Maximum 30 images per batch. Upload surface disables after 30 with a message.
- **Undo/redo** (PRD2 §3.1): Enable Tiptap's `History` extension. `Cmd+Z` / `Cmd+Shift+Z` with 100-step stack. "Revert to extracted" clears history and resets.
- **Debounced auto-save** (PRD2 §3.1): IndexedDB writes debounced to 1 second after last keystroke. "Saved" indicator fades in 500 ms after write, disappears after 2 seconds. Flush on `beforeunload`.
- **Copy Markdown to clipboard** (PRD2 §3.2): "Copy" button in editor toolbar. Copies `text/plain` (Markdown) and `text/html` (rendered) to clipboard. Confirmation toast. Graceful degradation if Clipboard API unavailable.
- **Note search** (PRD2 §3.3): Search input on home page (visible when ≥ 3 notes). Client-side `includes()` matching over title + markdown. Real-time filtering. Persists query in `localStorage`.
- **Custom 404 and error pages**: `not-found.tsx` and `error.tsx` at the app level with on-brand styling.

**Scope (out):** streaming; diff view; confidence; PDF upload; pre-processing; crop; math/code detection; export improvements; browser extension; onboarding; Service Worker.

**Deliverable:** A deployed app where a new visitor can't abuse the API, editor undo/redo works, notes auto-save without write amplification, text copies cleanly to clipboard, notes are searchable, and error states are handled gracefully.

**Key risks:**
- **Vercel Edge Config + KV may require a paid plan** or have latency implications on Edge routes. Mitigation: start with a simple in-memory rate limiter (per-process, resets on deploy). Document the trade-off. Migrate to KV when traffic justifies it.
- **Tiptap History extension** may conflict with `tiptap-markdown` serialization. Mitigation: verify in Phase 8 that undo/redo round-trips correctly with Markdown output.
- **Clipboard API** requires a secure context (HTTPS). Mitigation: Vercel provides HTTPS by default. Fallback to `document.execCommand('copy')` with plain text only in development (HTTP).

**Constraints:**
- Rate-limit configuration lives in `src/lib/rate-limit.ts` as constants, not env vars.
- Image count cap is enforced client-side (upload surface) and server-side (API validation).

**Depends on:** Phases 0–7 (complete).

---

## Phase 9 — Pipeline transparency

**Goal:** Users see and understand every AI decision. Trust replaces guesswork.

**Scope (in):**
- **SSE streaming** (PRD2 §3.4): New `GET /api/extract/stream` route (Node runtime) that streams VLM tokens as SSE events. Client-side orchestration updated to prefer streaming when available, with fallback to the existing `POST /api/extract`. Progress panel shows live text preview during extraction.
- **Diff view** (PRD2 §3.5): After the review pass, compute a word-level diff between pre-review and post-review Markdown using `fast-diff` (or `diff-match-patch` if bundle size is acceptable). Render in a collapsible panel above the editor with color-coded hunks (added = green, removed = red, moved = blue arrows). "Accept all and continue editing" dismisses the diff.
- **Confidence coloring** (PRD2 §3.6): Update the extraction prompt to emit `<!-- confidence: high|medium|low -->` markers per block. Parse markers client-side and annotate `ChunkMeta` with confidence data. Render subtle left-border colors in the editor (green/amber/red). Toggle to show/hide (default on for first visit, persisted to `localStorage`). Default to "unrated" when markers are absent.
- **Model fallback badges** (PRD2 §3.7): Surface the `model` field from extraction responses as a per-image badge in the image pane. Green/amber/red tints for Pro/Flash/Haiku. Dismissible banner when any image used a fallback model. Persist model info in `ChunkMeta` stored in IndexedDB.

**Scope (out):** PDF upload; pre-processing; crop; math/code detection; export improvements; browser extension; onboarding; Service Worker.

**Deliverable:** A user watches extraction text appear in real-time, sees a diff of what the review pass changed, identifies which sections to review (confidence coloring), and knows which images used fallback models. Trust is earned through transparency.

**Key risks:**
- **SSE through Vercel serverless is fragile.** Mitigation: Node runtime with explicit `Connection: keep-alive` headers. Fallback to non-streaming extraction if SSE fails. Do not remove the non-streaming endpoint — it remains the fallback.
- **Confidence markers may degrade extraction quality** if the model spends tokens on markers instead of content. Mitigation: the markers are short HTML comments (`<!-- confidence: high -->`), which are cheap. Evaluate on 10 fixtures. If quality degrades, switch to a separate classification call (adding cost and latency) or abandon confidence markers.
- **Diff view may be confusing** for users who don't understand what "review" means. Mitigation: plain-English labels ("What changed:", "Added by review", "Removed by review"). A "Learn more" link briefly explains the review pass.
- **`fast-diff` vs `diff-match-patch`**: `fast-diff` is 5KB and fast but produces less granular diffs for moved blocks. Mitigation: start with `fast-diff`. If move detection is important (it is for the review pass), evaluate `diff-match-patch` and accept the larger bundle for the note detail page only (lazy-load).

**Constraints:**
- SSE streaming extraction must not increase per-request cost. The same model call happens; only the delivery mechanism changes.
- Confidence markers must be stripped before the Markdown enters the editor. Only the `ChunkMeta` annotations persist.
- The diff view is computed client-side and stored in memory only — it is not persisted to IndexedDB.

**Depends on:** Phase 8.

---

## Phase 10 — Smarter input

**Goal:** More input types and better extraction quality on degraded inputs.

**Scope (in):**
- **PDF upload** (PRD2 §3.8): Accept `.pdf` files in the upload surface alongside images. Use `pdfjs-dist` (lazy-loaded) to render each page to a canvas and extract native text where possible. Hybrid extraction: native text for text-heavy pages (≥ 80% coverage), VLM vision for image-heavy pages. Native text → Markdown conversion with structure inference (font size → heading level, bullet detection, table detection). PDF pages appear in the filmstrip with a PDF icon overlay and "Page N" label. Warning for > 50 pages.
- **Image pre-processing** (PRD2 §3.9): Client-side canvas pipeline before extraction: EXIF auto-rotation, contrast enhancement (histogram normalization for dark/washed-out screenshots), unsharp mask (radius 1.0, amount 0.5). "Enhanced" badge on pre-processed filmstrip thumbnails. Toggle in upload surface: "Auto-enhance images" (default on, persisted). Pre-processed image is sent to extraction; original is preserved in the image pane.
- **Region-select crop** (PRD2 §3.10): "Crop" button on each filmstrip image. Opens a rectangular selection overlay. Drag handles on corners and edges. "Apply" replaces the extraction region with the cropped area; original is preserved for context in the image pane. "Reset crop" restores the full image. Crop state stored per-image in `StagedImage`.
- **Math/code detection** (PRD2 §3.11): Post-extraction classification using Gemini Flash (low cost). Each chunk is tagged `prose`, `code`, or `math`. Tagged chunks are re-extracted with specialized prompts (code → fenced code blocks with language annotation; math → LaTeX `$...$` / `$$...$$`). Classification badge on each chunk in the image pane. Manual "Re-extract as code/math" override per image.

**Scope (out):** export improvements; browser extension; onboarding; Service Worker; streaming (Phase 9); diff view (Phase 9).

**Deliverable:** A user uploads a PDF, drops dark/blurry screenshots, crops a region from a cluttered screenshot, and gets code extracted as code and math as LaTeX. Every input type and quality level is handled.

**Key risks:**
- **`pdfjs-dist` is large (~2.5 MB).** Mitigation: lazy-load only when a PDF is detected. Use a dynamic `import()` and a Web Worker for PDF rendering to avoid blocking the main thread.
- **PDF native text → Markdown conversion is lossy.** Font-size heuristics for heading levels work ~80% of the time. Mitigation: run native text through the existing review pass (Phase 3) which can adjust heading levels. The review pass is already designed for this.
- **Native text coverage heuristic (≥ 80%) is a guess.** Mitigation: also check for garbled text (≥ 50% non-alphanumeric characters). If either check fails, fall back to VLM extraction for that page. Users see a "This page was extracted from image" or "Extracted from text" badge.
- **Image pre-processing may degrade some inputs.** Over-sharpening can introduce artifacts on already-sharp screenshots. Mitigation: conservative parameters (unsharp radius 1.0, amount 0.5). Disable pre-processing when the user turns off "Auto-enhance images."
- **Crop overlay accessibility.** Mitigation: keyboard support (Arrow keys to resize, Shift+Arrow to move, Enter to apply, Escape to cancel). Screen reader announcements for crop dimensions.
- **Math/code classification adds latency and cost.** Mitigation: classification runs in parallel with other pipeline steps. Re-extraction only for tagged chunks (typically 10–30% of a note). Skip classification if the batch has ≤ 3 images (the overhead isn't worth it).

**Constraints:**
- PDF processing happens entirely client-side. No PDF files are sent to the server. Only the rendered page images (or extracted text) are sent through the pipeline.
- `pdfjs-dist` worker must be loaded from CDN or bundled as a separate chunk to avoid inflating the main bundle.
- Pre-processing is applied before base64 encoding. The base64 payload sent to extraction may be slightly larger due to sharpening (JPEG compression absorbs this).
- Crop coordinates are stored as pixel ratios (0–1 range) in `StagedImage` so they survive image resizing.

**Depends on:** Phase 9 (the pipeline must support streaming before we add more input types; also, confidence markers are useful for evaluating PDF and pre-processing quality).

---

## Phase 11 — Export mastery

**Goal:** Professional-grade export options that cover every common need.

**Scope (in):**
- **Markdown download** (PRD2 §3.12): "Download Markdown" button in the theme panel. Generates a `.md` file with the note title as filename. Raw Markdown content only.
- **Table of contents** (PRD2 §3.13): Auto-generated TOC for notes with ≥ 3 headings. PDF: TOC section at the top with heading text as clickable internal `#anchor` links (no page numbers in v2 — deferred to v2.1 due to Puppeteer two-pass fragility on serverless). DOCX: Word-native TOC field (`TOC \o "1-3" \h \z \u`). Markdown: comment placeholder. Only `#` through `###` included. Toggle in theme panel: "Include table of contents" (default on for qualifying notes, persisted).
- **Custom page sizes and margins** (PRD2 §3.14): Page size selector (US Letter, A4, A5) and margins (Narrow 15mm, Standard 25mm, Wide 35mm) in the theme panel. Applied to PDF (`page.pdf()` options) and DOCX (page dimensions in `docx` library). Persisted in `localStorage` as part of theme preferences.
- **"Made with Powershot" opt-in footer** (PRD2 §3.15): Toggle in theme panel: "Add 'Made with Powershot' footer" (default off). When on, appends a small 8pt footer to PDF, DOCX, and Markdown exports. Text: "— Made with Powershot | powershot.app". Persisted as part of theme preferences.

**Scope (out):** browser extension; onboarding; Service Worker; pipeline changes.

**Deliverable:** A user downloads a Markdown file, gets a PDF with a TOC and A4 page size, or exports a DOCX with custom margins and a Powershot footer. Every common export need is covered.

**Key risks:**
- **TOC generation in Puppeteer is complex.** Generating page numbers requires a two-pass render (first pass to determine page breaks, second pass to insert the TOC with correct page numbers). Mitigation: defer page numbers to v2.1. Use heading text as clickable `#anchor` links in the TOC section, which works in a single pass.
- **Word TOC fields require a manual update in Word.** Mitigation: include a note in the export: "Press Ctrl+A then F9 in Word to update the table of contents." This is standard Word behavior.
- **PDF page size via `page.pdf()` options is reliable**, but `@page` CSS `size` property may not be supported in all Puppeteer versions. Mitigation: set page size in the Puppeteer `page.pdf()` options (which is more reliable than CSS `@page`). Use CSS `@page` for margins only.
- **Margin and size settings interact with the existing theme system.** Mitigation: extend the `ExportTheme` type (not replace). Body font, heading font, base size, line spacing, page size, margins, TOC toggle, and footer toggle are all orthogonal settings.

**Constraints:**
- TOC in PDF does not include page numbers in v2. Page numbers require a two-pass render which is fragile on serverless. Instead, use heading text as clickable internal links. Page numbers are deferred to v2.1.
- The footer text and URL are constants in `src/lib/theme/constants.ts`. They are not user-configurable.
- All new theme preferences (page size, margins, TOC, footer) extend the existing `localStorage` key (`powershot:export-theme`). Migration: if the key exists without new fields, defaults are applied.

**Depends on:** Phase 10 (export improvements are independent of input types but should ship after the pipeline stabilizes).

---

## Phase 12 — Browser extension

**Goal:** A browser extension eliminates the screenshot loop — one click captures a web page directly into Powershot.

**Scope (in):**
- **Extension project scaffold**: `extension/` directory at repo root. Vite + TypeScript build. Shared types via symlink to `src/lib/` (or a shared `packages/types` directory if monorepo tooling is added later). Chrome Manifest V3 + Firefox `browser.*` API compatibility via `webextension-polyfill`.
- **Capture modes** (PRD2 §3.16):
  - **Visible tab**: `chrome.tabs.captureVisibleTab()` / `browser.tabs.captureVisibleTab()`. One click, one image.
  - **Full page**: Content script auto-scrolls the page, captures visible tabs at each scroll position, and stitches them into a single tall image via canvas compositing. Fall back to `captureVisibleTab` for sites where content script injection fails.
  - **Selection**: Content script injects an overlay where the user draws a rectangle. `captureVisibleTab` + canvas crop.
- **Extension popup UI**: Three buttons (Visible tab, Full page, Selection). "Open Powershot" link and keyboard shortcut indicator (`Ctrl+Shift+S`). Light/dark mode matching browser theme.
- **Post-capture flow**: Extension opens `https://[app-url]/new?source=extension` and sends captured images via `postMessage`. The `/new` page listens for `POWERSHOT_CAPTURE` messages and pre-fills the upload surface.
- **Keyboard shortcut**: `Ctrl+Shift+S` triggers "Visible tab" capture.
- **Chrome Web Store submission**: Icons, screenshots, description, privacy policy link. Store review typically takes 1–3 business days.
- **Firefox Add-on submission**: `browser` namespace polyfill, same codebase. Firefox review typically takes 1–2 weeks.

**Scope (out):** onboarding; Service Worker; pipeline changes; export changes.

**Deliverable:** A user installs the extension, clicks "Visible tab" (or presses `Ctrl+Shift+S`), and the captured page appears in Powershot's upload surface ready for extraction. Full-page and selection capture also work.

**Key risks:**
- **Full-page capture is unreliable on many sites** (CSP, shadow DOM, iframes, dynamic content, fixed headers). Mitigation: implement a best-effort auto-scroll + stitch approach. Fall back to `captureVisibleTab` (visible area only) if stitching fails. Log failure sites for iterative improvement.
- **Extension ↔ web app communication via `postMessage` requires both to be open.** Mitigation: the extension opens a new tab to Powershot's `/new` page first, then sends the message. If the tab isn't ready, queue the message and retry after navigation completes (listen for `window.onload`).
- **Chrome and Firefox have different extension APIs and review processes.** Mitigation: use `webextension-polyfill` for API compatibility. Test on both browsers. Expect Firefox review to take longer.
- **Full-page images can be very large** (10,000px+ tall). Mitigation: apply client-side resizing (same 1600px max dimension as the existing pipeline) before injecting into Powershot. This also keeps the extraction payload reasonable.
- **Extension icon and branding.** Need a Powershot icon in 16×16, 32×32, 48×48, 128×128 sizes. Mitigation: design assets are needed before store submission. This is a design task, not a code risk, but it can block submission.

**Constraints:**
- The extension communicates only via `postMessage` — no shared IndexedDB, no shared localStorage. The web app and extension are separate origins in development; `postMessage` is cross-origin safe.
- The extension does NOT call the Powershot API directly. It only captures images and sends them to the web app's upload surface. All API calls go through the web app.
- Permissions are minimal: `activeTab`, `scripting` (for content scripts), `downloads` (only if saving captures locally is desired; may not be needed). No `history`, no `bookmarks`, no `tabs` beyond `activeTab`.
- The extension must not introduce a new server-side dependency. Images flow: extension → web app (client-side) → server (extraction), same as manual upload.

**Depends on:** Phase 11 (the extension needs a stable, feature-complete `/new` page to inject into).

---

## Phase 13 — Growth & resilience

**Goal:** Instant value for new visitors; the app works offline for existing users.

**Scope (in):**
- **Onboarding with sample note** (PRD2 §3.17): "Try it with a sample" card on the home page when no notes exist. 4 pre-loaded sample images (lecture slide, documentation page, Slack conversation, recipe/article). Clicking "Try it" navigates to `/new?sample=true`, pre-fills the upload surface, and auto-starts the pipeline. Sample images are marked `transient` and cleaned up after the session. "Start fresh" clears the demo. Sample card disappears after the first real note.
- **Service Worker** (PRD2 §3.18): Register a Service Worker that caches the app shell (HTML, JS, CSS, fonts) with cache-first + versioned cache names. Stale-while-revalidate for static assets. No caching of `/api/*` routes. Offline flows:
  - **View notes:** Works (IndexedDB + cached app shell).
  - **Edit notes:** Works (Tiptap + IndexedDB).
  - **Export DOCX:** Works (pure JS, no server).
  - **Export Markdown:** Works (pure JS, no server).
  - **Copy to clipboard:** Works (Clipboard API).
  - **Export PDF:** Disabled with tooltip: "PDF export requires an internet connection."
  - **Generate (extraction):** Disabled with tooltip: "Extraction requires an internet connection."
  - **Upload surface:** Functional (client-side). Users can stage and reorder images offline; "Generate" is disabled.
  - Fallback offline page for uncached navigation requests.

**Scope (out):** queued extraction (too complex for v2); Chrome/Firefox extension (Phase 12); pipeline changes; export changes.

**Deliverable:** A first-time visitor instantly tries Powershot with sample data. A returning user can view, edit, and export their notes on an airplane.

**Key risks:**
- **Service Worker cache invalidation is the hardest problem in web development.** Mitigation: version cache names with the Next.js build hash. Use `skipWaiting()` + `clients.claim()` on update. Test thoroughly that new deploys don't serve stale content.
- **Next.js 16 App Router + Service Worker compatibility.** Mitigation: evaluate `next-pwa` or `@serwist/next` for Next.js 16 compatibility. If neither works cleanly, register the Service Worker manually in the root layout with a simple `sw.ts` file compiled with `esbuild`. The Service Worker only needs to cache static assets — no complex routing.
- **Sample images must not bloat the initial bundle.** Mitigation: load sample images lazily (only when the "Try it" card is rendered). Store them as static assets in `/public/samples/` and fetch on demand. Do not embed as base64 in the JS bundle.
- **Auto-starting the pipeline on sample data still costs API money.** Mitigation: sample extraction runs are rate-limited the same as regular runs. The total cost for 4 images (~$0.02) is negligible per new visitor. Consider this a customer acquisition cost.

**Constraints:**
- The Service Worker does not cache any `/api/*` responses. AI calls and exports must go to the server.
- Sample note images are loaded from `/public/samples/` (static assets), not from an external CDN. This avoids CORS and availability issues.
- The offline page is a simple HTML page with "You are offline" messaging and a "Try again" button. It is not a full app shell fallback.
- Auto-starting the sample pipeline should be cancellable. If the user navigates away before extraction completes, the pipeline should be aborted (reusing the existing `AbortSignal` mechanism).

**Depends on:** Phase 12 (the `/new` page must support extension injection before we add sample note injection; both use the same `postMessage` / pre-fill mechanism).