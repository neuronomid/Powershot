# Powershot v2 — Product Requirements Document

**Version:** 2.0
**Date:** April 23, 2026
**Status:** Draft for review
**Companion to:** [`PRD.md`](./PRD.md) (v1), [`Plan2.md`](./Plan2.md)

---

## 1. Summary

Powershot v1 turns screenshots into clean, structured notes. v2 turns a functional tool into a professional-grade product: smarter inputs, transparent AI, deeper exports, a browser extension that eliminates the screenshot loop entirely, and the infrastructure to share it safely with the world.

The core bet of v1 — that a vision model extracts better than OCR — is proven. v2 bets that giving users more input types (PDFs, cropped regions, pre-processed images), more visibility into what the AI did (streaming, diffs, confidence scores), and more ways to get their text out (clipboard, Markdown files, TOC, page sizes) transforms a tool people use into one they trust, rely on, and recommend.

---

## 2. Goals and non-goals

### Goals

- Increase extraction quality on degraded, low-contrast, tilted, or screenshot-of-screenshot inputs.
- Give users visibility into and trust over every AI decision (diffs, confidence, fallback transparency).
- Accept PDF files as first-class input alongside images, with hybrid text/vision extraction.
- Provide professional-grade export options: Markdown download, auto-generated TOC, configurable page sizes and margins.
- Reduce friction from "I see something on screen" to "I have a note" via a browser extension (Chrome + Firefox).
- Make the app usable without network for viewing, editing, and exporting existing notes.
- Protect the service from abuse with rate limiting before public launch.
- Ensure end-to-end reliability with comprehensive pipeline and export tests.

### Non-goals for v2

- User accounts, authentication, or cloud persistence (still deferred to v3+).
- Shareable note links or social sharing infrastructure (requires server-side storage; deferred).
- Multilingual extraction (the VLM handles some multilingual text already; explicit support is v3+).
- Handwriting recognition.
- Mobile native app or PWA camera integration.
- Collaborative or real-time editing.

---

## 3. Feature specifications

### 3.1 Undo/redo and debounced auto-save

**Problem:** Users currently have no undo history in the Tiptap editor and every keystroke writes to IndexedDB immediately, causing unnecessary write amplification.

**Spec:**

- Implement Tiptap's built-in `History` extension (undo: `Cmd+Z`, redo: `Cmd+Shift+Z`).
- Maintain a stack of at least 100 undo steps.
- Debounce IndexedDB writes to 1 second after the last keystroke. Show a subtle "Saved" indicator that appears 500 ms after a write completes and fades after 2 seconds.
- On page unload (`beforeunload`), flush any pending debounced write synchronously.
- "Revert to extracted" clears the undo history and resets to the original reviewed Markdown.

### 3.2 Copy Markdown to clipboard

**Problem:** Many users want the text in Notion, Obsidian, Slack, or a text editor — not a file download.

**Spec:**

- Add a "Copy" button in the editor toolbar (and optionally in the theme panel).
- Copies the current Markdown to the clipboard in two formats:
  - `text/plain`: raw Markdown source.
  - `text/html`: rendered HTML (via the existing `remark` + `rehype` pipeline) for rich paste into Gmail, Slack, etc.
- Show a brief confirmation toast: "Copied to clipboard".
- Fallback: if the Clipboard API is unavailable, copy plain Markdown only and show "Copied as plain text".

### 3.3 Note search

**Problem:** Users with 20+ notes can't find what they need on the home screen.

**Spec:**

- Add a search input at the top of the home screen (`/`), visible when ≥ 3 notes exist.
- Search is client-side, operating over the note `title` and `markdown` fields stored in IndexedDB.
- Uses simple `includes()` matching (case-insensitive). No need for a full-text search engine at this scale.
- Results filter in real-time as the user types.
- Empty state: "No notes match your search" with a "Clear search" link.
- Search term persists in `localStorage` under `powershot:search-query` so it survives page reloads within the same session.

### 3.4 Progressive streaming display

**Problem:** Users see "Extracting..." for each image and wait. The psychological experience of 30 seconds of text materializing is dramatically better than 30 seconds of a spinner.

**Spec:**

- Switch the extraction API from a single response to Server-Sent Events (SSE).
- Stream tokens from the VLM as they arrive, forwarding each chunk to the client.
- The progress panel updates per-image status to "Extracting..." with a live text preview that fills in progressively.
- When the stream completes, the full Markdown is finalized and moves to "Reviewing" or "Done".
- If streaming fails mid-way (network error, model error), the partial text is preserved and the image is marked as "Failed" with a retry button. The partial text is not used in the final output.
- SSE route runs on Node runtime (Edge has inconsistent SSE support across providers).

### 3.5 Diff view (post-review changes)

**Problem:** Users trust or distrust the AI blindly. Showing exactly what changed between raw extraction and reviewed output builds trust and lets users focus their review.

**Spec:**

- After the review pass completes, compute a word-level diff between the pre-review Markdown and the post-review Markdown.
- Display the diff as an expandable panel above or beside the editor, showing:
  - **Green/highlighted additions** (content the review pass added — should be rare due to the no-paraphrasing constraint, but surfaced when they occur).
  - **Red/strikethrough deletions** (content the review pass removed — typically deduplication remnants or structural reorganization).
  - **Moved blocks** (sections the review pass reordered, shown as arrow indicators).
- A "Review changes" mode shows the diff; a "Continue editing" button dismisses it and opens the clean editor.
- The diff is stored in memory only — it is not persisted to IndexedDB.

### 3.6 Confidence coloring

**Problem:** Users don't know which parts of the extraction to focus their manual review on.

**Spec:**

- Instruct the VLM extraction prompt to also emit a per-paragraph confidence indicator: `high`, `medium`, or `low`, using a lightweight inline marker (e.g., `<!-- confidence: medium -->` before each block).
- Parse these markers in the pipeline client-side and annotate the chunk anchors with confidence data.
- In the editor, render a subtle left-border color on each paragraph:
  - **Green** (`hsl(142 71% 45%)`) — high confidence, likely correct.
  - **Amber** (`hsl(38 92% 50%)`) — medium confidence, worth reviewing.
  - **Red** (`hsl(0 84% 60%)`) — low confidence, probably check this.
- A toggle in the editor toolbar shows/hides confidence coloring (default: on for the first visit, persisted to `localStorage`).
- If the model does not emit confidence markers (e.g., fallback models), all blocks default to "unrated" (neutral, no border color).

### 3.7 Model fallback transparency

**Problem:** When a chunk falls back from Gemini Pro to Flash or Haiku, the extraction quality may differ. Users are unaware.

**Spec:**

- The extraction API response already includes `{ model }` indicating which model was used. Surface this in the UI.
- On the note detail page, show a per-image model badge in the image pane:
  - "Gemini 2.5 Pro" (green tint)
  - "Gemini 2.5 Flash" (amber tint, with tooltip: "Fallback model used — consider reviewing this section")
  - "Claude Haiku 4.5" (red tint, with tooltip: "Secondary fallback — please review carefully")
- If any image used a fallback model, show a dismissible banner at the top of the editor: "X images used a fallback model. You may want to review those sections more carefully."
- Model information is stored in the note's chunk anchors and persisted to IndexedDB.

### 3.8 PDF upload with hybrid extraction

**Problem:** Many users screenshot PDFs page by page. Letting them upload a PDF directly eliminates that friction and can produce higher-quality extraction.

**Spec:**

- Accept `.pdf` files in the upload surface alongside images.
- Use `pdfjs-dist` to render each page to a canvas image (same 1600px max, JPEG 85% quality as the existing image resize pipeline).
- **Hybrid extraction mode:**
  1. Attempt native text extraction using `pdfjs-dist`'s text layer. If a page has ≥ 80% text coverage (by character area vs. page area), use the native text directly — converting it to Markdown with structure inference (heading detection via font size, list detection, table detection).
  2. If text coverage is < 80% (scanned PDF, image-heavy pages), render the page to an image and send it through the existing VLM extraction pipeline.
  3. If native text extraction produces garbled or mostly-symbol output (common in scanned PDFs with OCR text layers), fall back to VLM extraction.
- PDF pages appear in the filmstrip with a PDF icon overlay and "Page N" labels.
- The entire upload, ordering, and pipeline flow works identically for PDF pages as for screenshots — reordering, dedup, review, everything.
- Large PDFs (> 50 pages) show a warning: "Large PDFs may take longer. Consider splitting into sections."

### 3.9 Image pre-processing

**Problem:** Low-quality screenshots (dark, low contrast, skewed, blurry) produce poor extraction results. Client-side pre-processing can dramatically improve VLM input quality.

**Spec:**

- Before sending an image to extraction, apply a client-side pre-processing pipeline:
  1. **Auto-rotate:** Read EXIF `Orientation` tag and rotate the image accordingly. Many phone screenshots are stored with the wrong orientation flag.
  2. **Contrast enhancement:** Apply a mild contrast stretch (histogram normalization) to screenshots that appear dark or washed out. Detection: compute histogram; if > 70% of pixels fall in the bottom 30% of brightness, apply enhancement.
  3. **Sharpening:** Apply an unsharp mask (radius 1.0, amount 0.5) to all images. This is a lightweight, quality-improving default for text-heavy screenshots.
- Pre-processing happens on canvas, before base64 encoding. The pre-processed image is what gets sent to extraction; the original is preserved in the image pane for reference.
- A subtle indicator on each filmstrip thumbnail: "Enhanced" badge when pre-processing altered the image beyond rotation.
- Pre-processing is enabled by default. A toggle in the upload surface allows disabling it: "Auto-enhance images" (default: on, persisted to `localStorage`).

### 3.10 Region-select crop

**Problem:** Screenshots often include sidebars, navigation, ads, or other irrelevant content. Users should be able to select just the region they want extracted.

**Spec:**

- After uploading, each image in the filmstrip has a "Crop" button (scissors icon).
- Clicking "Crop" opens a crop overlay on the image — a rectangular selection tool with drag handles on all corners and edges.
- The user adjusts the crop region and clicks "Apply". The cropped region replaces the full image for extraction.
- The full original image is preserved and shown in the image pane (left side) as context, with the cropped region highlighted.
- A "Reset crop" button restores the full image for extraction.
- Crop state is stored per-image in the `StagedImage` object and survives reordering.

### 3.11 Math/code detection modes

**Problem:** The default extraction prompt treats everything as prose. Code screenshots and math formulas are common in the target audience (students, researchers) and deserve specialized extraction.

**Spec:**

- After extraction, run a lightweight classification pass on each chunk using Gemini Flash (low cost, fast):
  - If the chunk contains code-like patterns (consistent indentation, syntax keywords, bracket pairs, monospace visual patterns), tag it as `code`.
  - If the chunk contains math-like patterns (equations, symbols from the math Unicode block, fraction layouts, `∫∑∏√` characters), tag it as `math`.
  - Otherwise, tag it as `prose`.
- For chunks tagged `code`, re-extract with a code-specialized prompt that:
  - Wraps code blocks in triple backticks with appropriate language annotation (inferred from syntax).
  - Preserves indentation exactly.
  - Does not attempt to "read" code as prose.
- For chunks tagged `math`, re-extract with a math-specialized prompt that:
  - Wraps inline math in `$...$` and display math in `$$...$$` using LaTeX notation.
  - Preserves equation structure over textual layout.
- Classification results and re-extraction are performed automatically. The user sees a badge on each chunk in the image pane: "Code", "Math", or no badge for prose.
- This is a **post-processing step** — the default extraction runs first, then classification tags chunks for potential re-extraction. Re-extraction only happens for tagged chunks, keeping costs low.
- A "Re-extract as code/math" manual override is available per-image in case classification missed something.

### 3.12 Markdown file download

**Problem:** Users who work in Obsidian, VS Code, or other Markdown-native tools want a `.md` file, not a PDF or DOCX.

**Spec:**

- Add a "Download Markdown" button alongside the existing PDF/DOCX buttons in the theme panel.
- Generates a `.md` file with the note title as the filename (sanitized for filesystem compatibility).
- The Markdown file contains only the note content — no metadata frontmatter, no YAML header (unless the user edits it in; in v2, we keep it simple).
- Theme settings are irrelevant for Markdown export (it's raw text), so the theme panel does not affect this button's output.

### 3.13 Table of contents generation

**Problem:** Multi-page notes have 5–20 headings and no easy way to navigate within the exported document.

**Spec:**

- When exporting to PDF or DOCX, if the note contains ≥ 3 headings, automatically generate a Table of Contents.
- **PDF:** Render a TOC section at the top of the document with heading text as clickable internal `#anchor` links. Page numbers require a two-pass Puppeteer render (deferred to v2.1 due to fragility on serverless). Instead, include heading text and `#`-style links in the TOC section.
- **DOCX:** Insert a Word-native TOC field (`TOC \o "1-3" \h \z \u`). Users can update it in Word with `Ctrl+F9`. Heading styles are already mapped correctly from the existing export pipeline.
- **Markdown:** Skip TOC (Markdown tooling has its own TOC conventions). However, add a table of contents comment at the top: `<!-- TOC placeholder: your editor may auto-generate one -->`.
- The TOC is generated from the heading hierarchy. Only headings `#` through `###` are included in the TOC by default. `####` and below are excluded to keep it concise.
- A toggle in the theme panel: "Include table of contents" (default: on for notes with ≥ 3 headings, persisted).

### 3.14 Custom page sizes and margins

**Problem:** International users need A4; academic users need specific margins; some prefer compact Letter layouts. The current export assumes a single format.

**Spec:**

- Add page size and margin controls to the theme panel:
  - **Page size:** A4 (210×297mm), US Letter (8.5×11in), A5 (148×210mm). Default: US Letter.
  - **Margins:** Narrow (15mm), Standard (25mm), Wide (35mm). Default: Standard.
- These settings feed into:
  - **PDF:** Puppeteer `page.pdf()` options with `format` and `margin` properties.
  - **DOCX:** Word page dimensions and margin properties in the `docx` library section config.
- Page size and margin persist in `localStorage` as part of the theme preferences.

### 3.15 "Made with Powershot" footer (opt-in)

**Problem:** Organic discovery is the primary growth channel for a privacy-first tool with no accounts. Every exported document is a potential touchpoint.

**Spec:**

- Add a "Footer" toggle in the theme panel: "Add 'Made with Powershot' footer" (default: off).
- When enabled, the export includes a small footer on the last page (PDF) or at the end of the document (DOCX):
  - PDF: `— Made with Powershot | powershot.app` in 8pt muted color, right-aligned.
  - DOCX: Same text as a centered footer paragraph in 8pt gray (RGB 156 163 175).
  - Markdown: `*Made with [Powershot](https://powershot.app)*` at the end.
- The footer text and URL are constants, not user-configurable.
- The toggle persists in `localStorage` as part of theme preferences.

### 3.16 Browser extension (Chrome + Firefox)

**Problem:** The current flow requires taking screenshots, saving them, opening Powershot, and uploading. A browser extension collapses this to one click.

**Spec:**

- **Manifest:** Chrome (Manifest V3) and Firefox (browser-compat manifest). Shared codebase with minor `chrome.*` / `browser.*` API differences abstracted behind a thin wrapper.
- **Capture modes:**
  - **Visible tab:** Captures the currently visible viewport. One click.
  - **Full page:** Captures the entire scrollable page, auto-scrolling and stitching if the page exceeds the viewport. If `chrome.captureVisibleTab` / `browser.captureVisibleTab` is available, use it; otherwise, fall back to scrolling + stitching via content scripts.
  - **Selection:** User draws a rectangle on the page to capture just that region.
- **Post-capture flow:**
  1. Extension captures the image(s) as a PNG data URL.
  2. Extension opens a new tab pointing to `https://[powershot-app-url]/new?source=extension` with images injected via `postMessage` or a shared `IndexedDB`/`localStorage` bridge.
  3. The Powershot `/new` page detects the injected images and pre-fills the upload stage.
- **Extension popup UI:** A small popup with three buttons (Visible tab, Full page, Selection) plus a "Open Powershot" link. Dark/light mode matching the browser theme.
- **Keyboard shortcut:** Default `Ctrl+Shift+S` (customizable) triggers "Visible tab" capture.
- **Permissions:** `activeTab`, `scripting`, `downloads` (for saving captured images). No `history`, `bookmarks`, or `tabs` beyond `activeTab`.
- **Firefox notes:** Firefox supports the `browser.clipboard` API for full-page capture. Use `browser` namespace polyfill for compatibility. The Firefox Add-on store has its own review process — plan for an extra 1–2 weeks.

### 3.17 Onboarding with sample note

**Problem:** First-time visitors must bring their own screenshots before they understand the value. Reducing time-to-value from minutes to seconds increases conversion.

**Spec:**

- On the home page (`/`), when no notes exist, show a "Try it with a sample" card with 3–4 pre-loaded sample screenshots (embedded as base64 in the bundle, or fetched from a static CDN asset).
- Sample images represent common use cases:
  1. A lecture slide (academic).
  2. A documentation page (developer).
  3. A Slack conversation (professional).
  4. A recipe or article (general).
- Clicking "Try it" navigates to `/new?sample=true`, which pre-fills the upload surface with these images and auto-starts the pipeline.
- The result is a fully interactive note that the user can edit, theme, and export — a complete demo with zero friction.
- Sample images are not persisted to IndexedDB after the demo session ends (they are marked as `transient` and cleaned up).
- A "Start fresh" button clears the demo and shows the empty upload surface.
- After the first real note is created, the sample card no longer appears (the home page shows real notes instead).

### 3.18 Service Worker (offline: view, edit, export)

**Problem:** Users should be able to view and edit their existing notes without a network connection. Extraction requires the AI pipeline, but reading, editing, and exporting should work offline.

**Spec:**

- Register a Service Worker that caches:
  - The app shell (HTML, JS, CSS, fonts) using a cache-first strategy with versioned cache names.
  - A fallback offline page for navigation requests that aren't cached.
- IndexedDB is already available offline (it's a browser API). No changes needed for note storage.
- Key offline flows:
  - **View notes:** Works — notes are in IndexedDB, the app shell is cached.
  - **Edit notes:** Works — Tiptap runs client-side, saves to IndexedDB.
  - **Export:** Works for DOCX (the `docx` library is pure JS, no server). PDF export requires Puppeteer (server-side), so:
    - If offline, the PDF export button is disabled with a tooltip: "PDF export requires an internet connection."
    - The Markdown export and DOCX export buttons remain functional.
    - A "Copy to clipboard" button (§3.2) works offline.
  - **/new page:** The upload surface works (it's client-side). The "Generate" button is disabled with a tooltip: "Extraction requires an internet connection." Users can still stage and reorder images offline.
- Cache versioning: on deploy, the Service Worker updates its cache. Stale-while-revalidate for static assets. No caching of API responses (extraction, dedup, review, export — these are all POST and shouldn't be cached).
- The Service Worker is registered in the root layout, not per-page.

### 3.19 Rate limiting and abuse protection

**Problem:** API routes are wide open. Before public launch, abuse protection is essential.

**Spec:**

- **Vercel-native rate limiting** using Vercel's Edge Config + KV for per-IP rate limiting.
  - Extraction: 20 requests per IP per hour.
  - Dedup: 20 requests per IP per hour.
  - Review: 20 requests per IP per hour.
  - Export: 30 requests per IP per hour.
  - These limits are generous for legitimate users and restrictive for abuse.
- **Request-size validation:** Reject any request body > 5 MB at the Edge level (before it reaches the serverless function).
- **Image count cap:** Maximum 30 images per batch via the upload surface. After 30, the upload surface disables with a message: "Maximum 30 images per note."
- **Rate-limit response:** `429 Too Many Requests` with a `Retry-After` header and a user-friendly message: "You've reached the limit for now. Please try again in X minutes."
- **No CAPTCHA or accounts required.** Rate limiting is IP-based exclusively for v2.
- Rate-limit configuration is stored in `src/lib/rate-limit.ts` as constants (not env vars) so it can be updated in a deploy.

### 3.20 E2E pipeline and export tests

**Problem:** E2E tests currently cover upload and ordering but not extraction, review, or export. These are the core value prop and must be tested.

**Spec:**

- **Pipeline tests (Playwright):**
  - Mock OpenRouter responses with fixture data (realistic Markdown extraction, dedup, and review outputs).
  - Test the full flow: upload images → confirm order → generate (mocked) → preview → edit → export.
  - Verify per-image progress states transition correctly.
  - Verify the editor renders the final Markdown.
  - Verify "Revert to extracted" works.
- **Export tests (Playwright):**
  - Generate a PDF from a note with known content. Verify the PDF contains expected text (using a PDF parsing library on the test side).
  - Generate a DOCX from the same note. Verify heading styles, table structure, and font settings.
  - Verify theme settings (Sepia, custom font, size) are reflected in the export output.
- **Regression fixture set:**
  - 5 PDFs with known content (1 all-text, 1 scanned/image, 1 mixed, 1 with tables, 1 with math/code).
  - 10 images with known expected outputs (hand-verified Markdown).
  - Run in CI (once CI is set up) and locally via `pnpm test:e2e`.

### 3.21 Diff view — technical specification

**Word-level diff algorithm:**
- Use `diff-match-patch` (or a lightweight equivalent) to compute the diff between pre-review and post-review Markdown.
- Classify diff hunks as:
  - `added` — content added by the review pass (rare, should be flagged).
  - `removed` — content removed by the review pass (dedup seams, reorganized sections).
  - `moved` — blocks that appear in a different position (detected by finding the same content in both versions at different offsets).
- Render the diff in a collapsible `<details>` element above the editor. Each hunk is shown inline with color coding.
- The diff panel has two actions: "Review changes" (opens the diff), and "Accept all and continue editing" (dismisses the diff and opens the clean editor).

---

## 4. Technical architecture (changes from v1)

### 4.1 New dependencies

| Package | Purpose |
|---------|---------|
| `pdfjs-dist` | PDF rendering and text layer extraction |
| `diff-match-patch` | Word-level diff computation for the diff view |
| `@tiptap/extension-history` | Undo/redo support (if not bundled in StarterKit — otherwise, just enable it) |
| `idb` (existing) | Already used; no change |
| Vercel Edge Config + KV | Rate limiting (or a lightweight in-memory approach for single-instance deploys) |

### 4.2 New API routes

| Route | Runtime | Purpose |
|-------|---------|---------|
| `GET /api/extract/stream` | Node (SSE) | Streaming extraction — same logic as `POST /api/extract` but streams tokens via SSE |
| `POST /api/classify` | Edge | Classify an extracted chunk as `prose`, `code`, or `math` for re-extraction routing |

### 4.3 Modified API routes

| Route | Change |
|-------|--------|
| `POST /api/extract` | Accepts PDF page images alongside screenshots. Returns `{ markdown, model, confidence }` — confidence markers are parsed from the model output. |
| `POST /api/export?format=pdf` | Accepts `pageSize` and `margin` query params. Inserts TOC section when conditions are met. Appends "Made with Powershot" footer when requested. |
| `POST /api/export?format=docx` | Same TOC, page size, margin, and footer additions as PDF. |
| `POST /api/export?format=md` | New format. Returns raw Markdown file. |
| `POST /api/extract` (rate-limited) | Wrapped with rate-limit middleware. |

### 4.4 Browser extension

- Separate package in `extension/` directory at the repo root.
- Built with `vite` + `typescript`.
- Shared types from `src/lib/` via a shared `../shared/` directory or symlinks.
- Published to Chrome Web Store and Firefox Add-ons.

### 4.5 Service Worker

- `src/app/sw.ts` compiled with Vercel's built-in PWA support or via `next-pwa` (if compatible with Next.js 16 App Router).
- Cache manifest lists all static assets and fonts.
- No caching of `/api/*` routes.

### 4.6 Data model changes

The `Note` type in `src/lib/note/types.ts` gains:

```typescript
interface Note {
  // ... existing fields ...
  chunks: ChunkMeta[];
}

interface ChunkMeta {
  imageIndex: number;
  model: string;          // Which model was used for extraction
  confidence: 'high' | 'medium' | 'low' | 'unrated';
  classification: 'prose' | 'code' | 'math';
  croppedRegion: { x: number; y: number; width: number; height: number } | null;
  enhanced: boolean;      // Whether image pre-processing was applied
  source: 'screenshot' | 'pdf-page';
}
```

The `ExportTheme` type gains:

```typescript
interface ExportTheme {
  // ... existing fields ...
  pageSize: 'us-letter' | 'a4' | 'a5';
  margins: 'narrow' | 'standard' | 'wide';
  includeToc: boolean;
  includeFooter: boolean;
}
```

---

## 5. Non-functional requirements

- **Performance:** 20-screenshot note end-to-end in under 60 seconds (unchanged from v1). PDF processing should not add more than 5 seconds per page above the VLM extraction time.
- **Streaming latency:** First token from the extraction SSE stream should arrive within 3 seconds of the API call.
- **Offline:** App shell loads in < 2 seconds on a repeat visit (cached). Note editing and DOCX export work fully offline.
- **Rate limits:** Enforced per IP, per hour. Legitimate users should never hit them during normal usage.
- **Browser extension:** Extension popup loads in < 300ms. Full-page capture completes in < 5 seconds for a page with 10,000px scroll height.
- **Test coverage:** E2E tests cover the full pipeline (upload → extract → dedup → review → export) with mocked AI responses. Unit tests cover pre-processing, PDF text extraction, diff computation, and rate limiting.
- **Accessibility:** New features (diff view, confidence coloring, crop overlay, extension popup) meet WCAG AA.
- **Privacy:** No new server-side persistence. PDF files are processed client-side (rendered to images in the browser). The browser extension sends images directly to the Powershot app (client-side), not to a separate server.

---

## 6. Success metrics

- **Extraction quality on degraded inputs:** ≥ 15% reduction in user edits after extraction on low-contrast/skewed/tilted inputs, measured via the eval harness on a new fixture set of 15 degraded screenshots.
- **Streaming adoption:** ≥ 80% of extraction requests use the SSE endpoint (once both exist, the non-streaming endpoint is deprecated).
- **PDF upload adoption:** ≥ 20% of new notes include at least one PDF within 30 days of launch.
- **Diff view engagement:** ≥ 50% of users who see the diff view interact with it (expand, review, or dismiss).
- **Copy-to-clipboard usage:** ≥ 30% of note sessions include at least one clipboard copy (measured client-side, no telemetry).
- **Extension installs:** ≥ 500 active users within 30 days of Chrome Web Store launch.
- **Offline usage:** ≥ 10% of repeat visitors use the app offline at least once (measured by Service Worker cache hits vs. network requests).
- **Rate limit effectiveness:** ≤ 0.1% of legitimate users hit rate limits within the first 90 days.
- **E2E test coverage:** ≥ 10 Playwright scenarios covering upload, extraction, dedup, review, editing, and export.

---

## 7. Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `pdfjs-dist` bundle size inflates client bundle significantly | Medium | Load `pdfjs-dist` lazily (dynamic import) only when a PDF file is detected in the upload. The worker file is loaded separately. |
| Full-page capture in the extension is inconsistent across sites (CSP, shadow DOM, iframes) | High | Fall back to `captureVisibleTab` for sites where full-page capture fails. Log failures for iterative improvement. |
| SSE streaming adds complexity to the extraction pipeline and may break the existing concurrent orchestration | Medium | Implement SSE as a separate route (`GET /api/extract/stream`) while keeping the existing `POST /api/extract` as fallback. Migrate gradually. |
| VLM confidence markers are unreliable — some models ignore the instruction | Medium | Default to "unrated" when no markers are present. Never block the pipeline on confidence parsing failure. |
| Math/code classification adds cost (extra Flash call per chunk) and latency | Medium | Only classify after initial extraction. Skip re-extraction if the initial extraction already looks high-quality (heuristic: low edit distance between extraction and review output). |
| Service Worker caching breaks on deploy due to stale assets | Medium | Version the cache name with the build hash. Use `skipWaiting()` + `clients.claim()` on update. |
| Rate limiting using Vercel KV introduces a new dependency and cost | Low | Start with a simple in-memory rate limiter (works for single-instance deploys). Move to Vercel KV when scaling requires it. |
| The `diff-match-patch` dependency adds weight to the client bundle | Low | Heavy (100KB+). Evaluate lightweight alternatives (e.g., `fast-diff` at 5KB) before committing. |

---

## 8. Phasing

See [`Plan2.md`](./Plan2.md) for the detailed phase-by-phase development plan. Phases 8–13 build on the completed Phases 0–7 from [`Plan.md`](./Plan.md).

---

## Appendix A — PDF hybrid extraction decision flow

```
User uploads .pdf
    │
    ▼
pdfjs-dist renders each page to canvas (for filmstrip preview)
    │
    ├── Attempt native text extraction per page
    │   │
    │   ├── Text coverage ≥ 80%? ── YES ──► Use native text → Convert to Markdown
    │   │                                          │
    │   │                                          ▼
    │   │                                     Heuristic structure inference
    │   │                                     (font size → heading level,
    │   │                                      bullet/number detection → lists,
    │   │                                      grid detection → tables)
    │   │
    │   └── Text coverage < 80%? ── YES ──► Send canvas image to VLM extraction
    │                                          (existing pipeline)
    │
    └── If native text is garbled (≥50% non-alphanumeric)
        ──► Fall back to VLM extraction for that page
```

## Appendix B — Confidence marker format

The extraction prompt (modified from v1) appends:

```
After each Markdown block (paragraph, heading, list, table), insert a confidence marker:
<!-- confidence: high|medium|low -->

Rules for confidence:
- high: all text is clearly readable, no ambiguity in structure or content.
- medium: some text is unclear, blurry, partially cut off, or the structure is ambiguous.
- low: text is very hard to read, heavily cut off, or the structure cannot be determined with confidence.
```

The client-side pipeline strips these markers before displaying in the editor but preserves them in the `ChunkMeta` for confidence coloring.

## Appendix C — Browser extension message protocol

The extension communicates with the Powershot web app via `postMessage`:

```typescript
// Extension → Powershot app
interface ExtensionMessage {
  type: 'POWERSHOT_CAPTURE';
  images: Array<{
    dataUrl: string;   // base64 PNG data URL
    title: string;     // e.g., "Full page — example.com"
    source: 'visible-tab' | 'full-page' | 'selection';
  }>;
}

// Powershot app → Extension (acknowledgment)
interface AckMessage {
  type: 'POWERSHOT_CAPTURE_ACK';
  noteId: string;      // ID of the created note
}
```

The `/new` page listens for `POWERSHOT_CAPTURE` messages on `window` and pre-fills the upload surface with the received images.