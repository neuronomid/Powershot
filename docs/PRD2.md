# Powershot v2 — Product Requirements Document

**Version:** 2.1 (revised 2026-04-23 after audit)
**Date:** April 23, 2026
**Status:** Draft for review
**Companion to:** [`PRD.md`](./PRD.md) (v1), [`Plan2.md`](./Plan2.md)

---

## 1. Summary

Powershot v1 turns screenshots into clean, structured notes. v2 turns a functional tool into a professional-grade product: smarter inputs, transparent AI, deeper exports, a Chrome extension that eliminates the screenshot loop, and the infrastructure to share it safely with the world.

The core bet of v1 — that a vision model extracts better than OCR — is proven. v2 bets that giving users more input types (PDFs, cropped regions, rotation-corrected images), clear visibility into what the AI did (a summary of what review changed, per-image model badges), and more ways to get their text out (clipboard, Markdown files, TOC, page sizes) transforms a tool people use into one they trust, rely on, and recommend.

**Revision note.** This doc was revised after an audit of the initial v2 draft. Features that risked misleading users or degrading extraction quality — self-reported confidence coloring, automatic math/code classification, token-level streaming, aggressive default pre-processing, PDF native-text hybrid extraction, and a full offline Service Worker — were cut from v2 or deferred to v2.1. Section bodies for deferred items are left as one-line placeholders so cross-references remain stable.

---

## 2. Goals and non-goals

### Goals

- Increase extraction quality on degraded, low-contrast, tilted, or screenshot-of-screenshot inputs.
- Give users visibility into how the AI handled their input (a plain-English summary of what the review pass changed, per-image model badges, an overall batch progress bar with ETA).
- Accept PDF files as first-class input alongside images, processed through the existing VLM pipeline.
- Provide professional-grade export options: Markdown download, auto-generated TOC, configurable page sizes and margins.
- Reduce friction from "I see something on screen" to "I have a note" via a Chrome extension (visible-tab + region capture).
- Protect the service from abuse with rate limiting before public launch.
- Ensure end-to-end reliability with comprehensive pipeline and export tests, and no regression against the v1 fidelity harness.

### Non-goals for v2

- User accounts, authentication, or cloud persistence (still deferred to v3+).
- Shareable note links or social sharing infrastructure (requires server-side storage; deferred).
- Multilingual extraction (the VLM handles some multilingual text already; explicit support is v3+).
- Handwriting recognition.
- Mobile native app or PWA camera integration.
- Collaborative or real-time editing.
- **Deferred to v2.1:** token-level streaming; model-reported confidence coloring; automatic math/code classification with re-extraction; PDF native-text hybrid extraction (text-layer → Markdown structure inference); Firefox extension; full-page scroll-and-stitch capture; Service Worker / offline mode.

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

- Add a "Copy" button in the editor toolbar.
- **Default action:** copy raw Markdown source to the clipboard as `text/plain` only. This is what users editing in Notion/Obsidian/Slack/VS Code actually want — dual-format clipboards (plain + HTML) frequently cause host apps to paste the rendered HTML, turning the Markdown source into rich-text soup.
- **Secondary action:** a "Copy as rich text" menu option (accessible via a small caret next to the main button) writes both `text/plain` (raw MD) and `text/html` (rendered via the existing `remark` + `rehype` pipeline), for users pasting into Gmail or docs.
- Show a brief confirmation toast: "Copied to clipboard" / "Copied as rich text".
- Fallback: if the Clipboard API is unavailable, `document.execCommand('copy')` with plain Markdown.

### 3.3 Note search

**Problem:** Users with 20+ notes can't find what they need on the home screen.

**Spec:**

- Add a search input at the top of the home screen (`/`), visible when ≥ 3 notes exist.
- Search is client-side, operating over the note `title` and `markdown` fields stored in IndexedDB.
- Uses simple `includes()` matching (case-insensitive). No need for a full-text search engine at this scale.
- Results filter in real-time as the user types.
- Empty state: "No notes match your search" with a "Clear search" link.
- **The search term is session-only (in-memory) and does NOT persist across reloads.** Returning to a filtered home screen after a reload is disorienting — users have reported similar patterns as confusing in other tools.

### 3.4 Batch progress presentation

**Problem:** During a 30–60 second batch run, users currently see per-image status pills but no aggregate signal of how far along the whole batch is. A 20-image note that is 18 images in feels the same as a 20-image note that is 2 images in. Psychologically, a clear "almost done" signal reduces the perceived wait significantly.

**Spec:**

- **Overall progress bar.** A horizontal determinate progress bar sits at the top of the pipeline panel during a batch run. It fills in proportion to completed pipeline work, calculated as a weighted sum across stages so the bar moves smoothly rather than jumping in chunks:
  - Extraction: 70% of total weight, divided equally across images (an image that has completed extraction contributes `0.7 / N`).
  - Dedup: 10% of total weight (a single pass across the whole note).
  - Review: 20% of total weight (a single pass across the whole note).
  - While an image is mid-extraction (request in flight), it contributes half its weight — this gives the bar continuous motion rather than stepwise jumps.
- **Progress label.** A short text line next to the bar reads, depending on stage:
  - `"Extracting 7 of 20 images…"` during extraction.
  - `"Finding overlaps…"` during dedup.
  - `"Reviewing for structure…"` during review.
  - `"Done — opening editor"` at completion, visible for ~800 ms before transition.
- **Estimated time remaining.** After the third image completes, show a rough `"~25 seconds remaining"` estimate based on the median per-image extraction time observed so far in this batch. Update every time an image completes. Never show a shrinking ETA that then grows — if the median increases, hold the ETA steady until it catches up. Hide the ETA entirely if the batch has < 4 images (not enough signal).
- **Per-image status** (already in v1) continues to show in the filmstrip: `Queued`, `Extracting…`, `Done`, `Failed (retry)`. The overall bar complements, it does not replace, per-image status.
- **Failure does not reset the bar.** A failed image is counted as "work completed" for progress purposes (it's no longer pending); the user handles retries independently.
- **No progress bar on single-image runs** — a spinner is clearer than a determinate bar when N=1.

**Token-level SSE streaming is DEFERRED to v2.1.** Streaming tokens from the VLM as they arrive — the original §3.4 proposal — adds Node-runtime SSE plumbing, retry complexity, and a partial-text-vanishes-on-failure UX trap. Once the overall progress bar and ETA land, most of the "am I frozen?" anxiety that streaming would have addressed is already resolved. Revisit once we have real data on where users actually wait.

### 3.5 Review-change summary

**Problem:** Users trust or distrust the AI blindly. Showing what the review pass changed helps them focus their manual review and builds trust in the pipeline.

**Spec:**

- After the review pass completes, surface a compact **"What review changed"** panel above the editor. Because the review pass is bound by the token-subset guardrail (it may reorder and deduplicate but not reword), the dominant change category is deletions and block-level moves — not word-level substitutions.
- The panel shows:
  - **Removed passages** (text the review pass dropped, typically dedup-seam remnants) — shown inline as short quoted snippets with a "why" tag (`dedup`, `reorder`) when inferrable.
  - **Reordered blocks** — a compact list of "Section X moved above Section Y" entries, detected by matching block anchors between pre- and post-review Markdown.
- The panel does **not** attempt a full word-level diff rendering with green/red/blue highlighting. Word-level diffs on Markdown are noisy due to whitespace/wrap differences; move detection is unreliable. Keep the surface honest and low-false-positive.
- The panel collapses by default when the review pass made no deletions and no moves. Otherwise it's expanded with a "Dismiss" button that opens the clean editor.
- Diff computation uses `fast-diff` (~5 KB). `diff-match-patch` is rejected on bundle-size grounds.
- The change summary is stored in memory only — it is not persisted to IndexedDB.

### 3.6 Confidence coloring — **CUT from v2**

Model-reported confidence scores are known to be poorly calibrated: VLMs can be overconfident on hallucinations and under-confident on correct output. Painting red / amber / green borders on blocks based on these self-reports would actively mislead users — exactly the opposite of the stated "focus your review" goal — while also bloating every extraction with marker tokens.

If we want a "focus your review here" cue in a later revision, we should ground it in something observable (e.g., blocks where review-pass deletions were largest, or where the dedup stage cut seams), not model self-assessment.

### 3.7 Model fallback transparency

**Problem:** When a chunk falls back from Gemini Pro to Flash or Haiku, the extraction may differ. Users are unaware.

**Spec:**

- The extraction API response already includes `{ model }`. Surface this in the UI.
- On the note detail page, show a per-image model badge in the image pane as **neutral plain text** (e.g., "Gemini 2.5 Pro", "Gemini 2.5 Flash", "Claude Haiku 4.5"). No red/amber/green color coding — Haiku isn't universally worse than Flash, and alarm colors would mislead users about quality.
- When any image fell back from the primary model, show a single subtle info icon next to the badge with a tooltip: "A fallback model was used for this section; you may want to skim it."
- When at least one image in the note used any fallback, show a dismissible info banner at the top of the editor: "Some sections used a fallback model. Consider skimming the affected images."
- Model information is stored in the note's chunk metadata and persisted to IndexedDB.

### 3.8 PDF upload (VLM path)

**Problem:** Many users screenshot PDFs page by page. Letting them upload a PDF directly eliminates that friction.

**Spec:**

- Accept `.pdf` files in the upload surface alongside images.
- Use `pdfjs-dist` (lazy-loaded) to render each page to a canvas image using the same 1600px max dimension and JPEG 85% quality as the existing image resize pipeline.
- **Every page is routed through the existing VLM extraction pipeline.** v2 does **not** implement the "native text layer → heuristic Markdown structure inference" hybrid path. PDFs encode text in arbitrarily weird ways, and font-size-based heading inference / grid-based table inference is a tar pit. The VLM path gives us one extraction quality to reason about instead of two.
- PDF pages appear in the filmstrip with a PDF icon overlay and "Page N" labels.
- Reordering, dedup, review, and export work identically for PDF pages and screenshots.
- Large PDFs (> 50 pages) show a warning: "Large PDFs may take longer. Consider splitting into sections."
- **Deferred to v2.1:** native-text fast-path for text-heavy pages, revisited once we have usage data on what kinds of PDFs users actually upload.

### 3.9 Image pre-processing (minimal)

**Problem:** Low-quality screenshots can produce poor extraction. Some pre-processing helps; aggressive defaults hurt as often as they help.

**Spec:**

- **Default-on, always safe:** EXIF `Orientation` auto-rotation. Many phone screenshots are stored with the wrong orientation tag; rotating is free and strictly fixes a subset of inputs.
- **Opt-in, off by default:** a single "Enhance faint screenshots" toggle in the upload surface that applies contrast stretch (histogram normalization) and a mild unsharp mask (radius 1.0, amount 0.3). This is **opt-in** because:
  - Modern VLMs are robust to normal-quality screenshots; sharpening occasionally degrades text recognition on clean inputs.
  - Histogram normalization on dark-mode screenshots can invert perceived contrast and confuse the model.
  - We need real eval data from the fidelity harness before flipping the default.
- When the toggle is on, a subtle "Enhanced" badge appears on affected filmstrip thumbnails, and the original image is still shown in the image pane for reference.
- The toggle state persists in `localStorage`.
- **Before flipping the toggle default to on in v2.1:** run the enhancement on the fidelity-harness fixture set and require no regression in token overlap.

### 3.10 Region-select crop

**Problem:** Screenshots often include sidebars, navigation, ads, or other irrelevant content. Users should be able to select just the region they want extracted.

**Spec:**

- After uploading, each image in the filmstrip has a "Crop" button (scissors icon).
- Clicking "Crop" opens a crop overlay on the image — a rectangular selection tool with drag handles on all corners and edges.
- The user adjusts the crop region and clicks "Apply". The cropped region replaces the full image for extraction.
- The full original image is preserved and shown in the image pane (left side) as context, with the cropped region highlighted.
- A "Reset crop" button restores the full image for extraction.
- Crop state is stored per-image in the `StagedImage` object and survives reordering.
- Keyboard support: arrow keys resize, Shift+arrow moves, Enter applies, Escape cancels.

### 3.11 Math / code re-extraction (manual only)

**Problem:** The default extraction prompt treats everything as prose. Code screenshots and math formulas occasionally come out worse than they could with a specialized prompt.

**Spec:**

- **Automatic classification is cut.** The initial v2 draft called for a Gemini Flash classification pass on every chunk, with automatic re-extraction of tagged chunks. That pattern has three problems: (1) meaningful extra cost and latency per note, (2) classifier false positives on mixed-prose-with-inline-code, and (3) a confusing UX where the user watches one extraction silently get replaced by a different one.
- **v2 ships the high-value manual override only.** Each image in the image pane has a "Re-extract as…" menu with two options: **Code** and **Math**. Choosing "Code" re-runs extraction for that image with a code-specialized prompt (triple-backtick fenced blocks with language inferred from syntax, indentation preserved). Choosing "Math" re-runs with a math-specialized prompt (inline `$...$`, display `$$...$$` LaTeX).
- The resulting Markdown replaces the original chunk. The user explicitly opted in, so the change is unsurprising.
- **Deferred to v2.1:** automatic classification if post-launch data shows users frequently hitting the manual override for specific patterns.

### 3.12 Markdown file download

**Problem:** Users who work in Obsidian, VS Code, or other Markdown-native tools want a `.md` file, not a PDF or DOCX.

**Spec:**

- Add a "Download Markdown" button alongside the existing PDF/DOCX buttons in the theme panel.
- Generates a `.md` file with the note title as the filename (sanitized for filesystem compatibility).
- The Markdown file contains only the note content — no metadata frontmatter, no YAML header.
- Theme settings are irrelevant for Markdown export (it's raw text), so the theme panel does not affect this button's output.

### 3.13 Table of contents generation

**Problem:** Multi-page notes have 5–20 headings and no easy way to navigate within the exported document.

**Spec:**

- When exporting to PDF or DOCX, if the note contains ≥ 3 headings, automatically generate a Table of Contents.
- **PDF:** Render a TOC section at the top of the document with heading text as clickable internal `#anchor` links. Page numbers require a two-pass Puppeteer render (deferred to v2.1 due to fragility on serverless).
- **DOCX:** Insert a Word-native TOC field (`TOC \o "1-3" \h \z \u`). Users can update it in Word with `Ctrl+F9`. Heading styles are already mapped correctly from the existing export pipeline.
- **Markdown:** Skip TOC (Markdown tooling has its own TOC conventions).
- The TOC is generated from the heading hierarchy. Only headings `#` through `###` are included. `####` and below are excluded.
- Toggle in the theme panel: "Include table of contents" (default on for notes with ≥ 3 headings, persisted).

### 3.14 Custom page sizes and margins

**Problem:** International users need A4; academic users need specific margins; some prefer compact Letter layouts.

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
  - DOCX: Same text as a centered footer paragraph in 8pt gray.
  - Markdown: `*Made with [Powershot](https://powershot.app)*` at the end.
- The footer text and URL are constants, not user-configurable.
- The toggle persists in `localStorage` as part of theme preferences.

### 3.16 Chrome extension (v2.0 scope)

**Problem:** The current flow requires taking screenshots, saving them, opening Powershot, and uploading. A browser extension collapses this to one click.

**Spec:**

- **Platform:** Chrome (Manifest V3) only for v2.0. Firefox ships in v2.1.
- **Capture modes for v2.0:**
  - **Visible tab:** `chrome.tabs.captureVisibleTab()`. One click, one image.
  - **Region selection:** Content script injects an overlay where the user drags a rectangle. `captureVisibleTab` + canvas crop.
- **Deferred to v2.1:** full-page scroll-and-stitch capture (fragile across CSP / shadow DOM / fixed headers / infinite-scroll sites, flagged as High risk in the original draft), Firefox port.
- **Post-capture flow:**
  1. Extension captures the image(s) as a PNG data URL.
  2. Extension opens a new tab pointing to `https://[powershot-app-url]/new?source=extension`.
  3. After the tab emits `window.onload`, the extension sends images via `postMessage`.
  4. The `/new` page listens for `POWERSHOT_CAPTURE` messages and pre-fills the upload surface.
- **Extension popup UI:** Two buttons (Visible tab, Region) plus a "Open Powershot" link. Matches browser light/dark theme.
- **Keyboard shortcut:** Default `Alt+Shift+S` (not `Ctrl+Shift+S` — that collides with Chrome's built-in "Save page as" on Windows/Linux). Triggers "Visible tab" capture. User-customizable via `chrome://extensions/shortcuts`.
- **Permissions:** `activeTab`, `scripting`. No `history`, `bookmarks`, `tabs`, or `downloads`.
- **Distribution:** Chrome Web Store. Icons at 16/32/48/128 px required before submission.

### 3.17 Onboarding with sample note

**Problem:** First-time visitors must bring their own screenshots before they understand the value. Reducing time-to-value from minutes to seconds increases conversion.

**Spec:**

- On the home page (`/`), when no notes exist, show a "Try it with a sample" card with 3–4 pre-loaded sample screenshots (fetched on demand from `/public/samples/`, not base64-bundled).
- Sample images represent common use cases:
  1. A lecture slide (academic).
  2. A documentation page (developer).
  3. A Slack conversation (professional).
  4. A recipe or article (general).
- Clicking "Try it" navigates to `/new?sample=true`, which pre-fills the upload surface with these images and auto-starts the pipeline.
- The result is a fully interactive note that the user can edit, theme, and export — a complete demo with zero friction.
- Sample images are not persisted to IndexedDB after the demo session ends (marked `transient` and cleaned up).
- A "Start fresh" button clears the demo and shows the empty upload surface.
- After the first real note is created, the sample card no longer appears.

### 3.18 Service Worker / offline mode — **DEFERRED to v2.1+**

The initial draft proposed a Service Worker that caches the app shell and disables network-only actions (extract, PDF export) offline. For a tool whose core value is network-dependent extraction, the payoff is small (shell caching) and the downside is large (SW cache-invalidation bugs, a confusing "why can I edit but not export as PDF?" UX, and non-trivial Next.js 16 App Router integration work).

Revisit when we have evidence that users are actively trying to use the app offline.

### 3.19 Rate limiting and abuse protection

**Problem:** API routes are wide open. Before public launch, abuse protection is essential.

**Spec:**

- **Distributed rate limiter from day one** using Vercel KV (or Upstash Redis, whichever is operational). Per-IP counters, sliding window:
  - Extraction: 20 requests per IP per hour.
  - Dedup: 20 requests per IP per hour.
  - Review: 20 requests per IP per hour.
  - Export: 30 requests per IP per hour.
- **Do NOT use an in-process in-memory limiter.** Vercel serverless functions have no shared memory across invocations — each lambda has its own process — so an in-memory counter enforces nothing at scale. The original draft's "start with in-memory" suggestion was incorrect.
- **Request-size validation:** Reject any request body > 5 MB in route middleware before the AI call.
- **Image count cap:** Maximum 30 images per batch via the upload surface. After 30, the upload surface disables with a message: "Maximum 30 images per note."
- **Rate-limit response:** `429 Too Many Requests` with a `Retry-After` header and a user-friendly message: "You've reached the limit for now. Please try again in X minutes."
- **No CAPTCHA or accounts required.** Rate limiting is IP-based exclusively for v2.
- Rate-limit configuration is stored in `src/lib/rate-limit.ts` as constants so it can be updated in a deploy.

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
- **Fidelity harness regression gate:** Before merging any change that touches extraction prompts or pre-processing, require no regression in token overlap against the v1 fixture set.

### 3.21 Review-change summary — technical specification

Superseded by the reshaped §3.5. Implementation details:

- Use `fast-diff` (~5 KB) to compute a plain-text diff between pre- and post-review Markdown.
- Classify diff hunks into two user-facing categories only:
  - **`removed`** — text present in pre-review but absent in post-review.
  - **`moved`** — for each paragraph-level anchor present in both versions, compare positions; anchors whose position changed by more than one slot are reported as moves.
- Do **not** attempt to render word-level green/red highlighting inside paragraphs — the signal is too noisy under the token-subset guardrail to be worth the UI weight.
- The panel lives in a collapsible `<details>` above the editor. If there are zero removals and zero moves, it collapses silently with a muted "Review made no structural changes" caption.

---

## 4. Technical architecture (changes from v1)

### 4.1 New dependencies

| Package | Purpose |
|---------|---------|
| `pdfjs-dist` | PDF rendering (page-to-canvas). Native text-layer extraction is not used in v2. |
| `fast-diff` | Lightweight (~5 KB) diff for the review-change summary. |
| `@tiptap/extension-history` | Undo/redo support (if not bundled in StarterKit — otherwise, just enable it). |
| Vercel KV (or Upstash Redis) | Distributed rate limiter backing store. |

### 4.2 New API routes

None. The initial draft's `GET /api/extract/stream` (SSE) and `POST /api/classify` (auto math/code classification) are both deferred — see §3.4 and §3.11.

### 4.3 Modified API routes

| Route | Change |
|-------|--------|
| `POST /api/extract` | Accepts PDF page images alongside screenshots (same JPEG payload shape). Returns `{ markdown, model }`. Wrapped with rate-limit middleware. |
| `POST /api/dedup` | Rate-limit middleware. |
| `POST /api/review` | Rate-limit middleware. |
| `POST /api/export?format=pdf` | Accepts `pageSize` and `margin` query params. Inserts TOC section when conditions are met. Appends "Made with Powershot" footer when requested. |
| `POST /api/export?format=docx` | Same TOC, page size, margin, and footer additions as PDF. |
| `POST /api/export?format=md` | New format. Returns raw Markdown file. |

### 4.4 Browser extension

- Separate package in `extension/` directory at the repo root.
- Built with `vite` + `typescript`.
- Shared types from `src/lib/` via symlink or a small shared folder.
- v2.0: Chrome Web Store only. Firefox deferred to v2.1.

### 4.5 Service Worker — deferred

Not shipped in v2. See §3.18.

### 4.6 Data model changes

The `Note` type in `src/lib/note/types.ts` gains:

```typescript
interface Note {
  // ... existing fields ...
  chunks: ChunkMeta[];
}

interface ChunkMeta {
  imageIndex: number;
  model: string;          // Which model was used for extraction (for fallback badge)
  croppedRegion: { x: number; y: number; width: number; height: number } | null;
  enhanced: boolean;      // Whether opt-in pre-processing was applied
  source: 'screenshot' | 'pdf-page';
}
```

Note: the original draft included `confidence` and `classification` fields. Both are removed — `confidence` because §3.6 is cut, `classification` because §3.11 auto-classification is cut and manual re-extraction can simply replace the chunk content in place.

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
- **Fidelity:** No regression vs. the v1 fidelity harness on the existing fixture set. Any change touching extraction prompts or pre-processing must clear this gate.
- **Rate limits:** Enforced per IP, per hour, via a distributed store. Legitimate users should never hit them during normal usage.
- **Chrome extension:** Extension popup loads in < 300 ms. Visible-tab capture + post-message handoff completes in < 2 seconds on a typical page.
- **Progress bar:** First frame of the overall progress bar renders within 100 ms of the batch kickoff. ETA appears no later than after the 3rd completed image.
- **Test coverage:** E2E tests cover the full pipeline (upload → extract → dedup → review → export) with mocked AI responses. Unit tests cover the new pre-processing helpers, PDF-page rendering, diff computation, and rate limiting.
- **Accessibility:** New features (review-change summary, crop overlay, extension popup) meet WCAG AA.
- **Privacy:** No new server-side persistence. PDF files are processed client-side (rendered to images in the browser). The Chrome extension sends images to the Powershot web app via `postMessage` only — there is no extension-to-server communication and no shared storage between origins.

---

## 6. Success metrics

- **Extraction quality on degraded inputs:** ≥ 15% reduction in user edits after extraction on low-contrast/skewed/tilted inputs, measured via the eval harness on a new fixture set of 15 degraded screenshots.
- **Fidelity guardrail:** No regression (token overlap) on the existing fidelity-harness fixture set at launch vs. v1.
- **PDF upload adoption:** ≥ 20% of new notes include at least one PDF within 30 days of launch.
- **Review-change summary engagement:** ≥ 40% of users whose note had any removed/moved content expand the panel at least once.
- **Copy-to-clipboard usage:** ≥ 30% of note sessions include at least one clipboard copy (measured client-side, no telemetry).
- **Extension installs:** ≥ 500 active users within 30 days of Chrome Web Store launch.
- **Rate limit effectiveness:** ≤ 0.1% of legitimate users hit rate limits within the first 90 days.
- **E2E test coverage:** ≥ 10 Playwright scenarios covering upload, extraction, dedup, review, editing, and export.

Deferred metrics (for v2.1 when their features land): streaming adoption, offline usage.

---

## 7. Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `pdfjs-dist` bundle size inflates client bundle significantly | Medium | Load `pdfjs-dist` lazily (dynamic import) only when a PDF file is detected in the upload. The worker file is loaded separately. |
| Chrome extension `postMessage` handshake races with tab navigation | Medium | Extension queues captured images and sends after the new tab emits `window.onload`. Add a short retry (up to 3 attempts, 500 ms apart). |
| Opt-in pre-processing (contrast + sharpen) degrades some inputs | Medium | Ship opt-in only. Before flipping default, require no regression on the fidelity-harness fixture set. |
| Review-change summary fires on trivial whitespace diffs | Low | Paragraph-level anchoring; ignore hunks whose post-trim character count is < 3. |
| Rate-limit store (Vercel KV / Upstash) introduces cost and a new dependency | Low | Unavoidable cost of shipping safely. Budget a small monthly line item; the alternative (no rate limiting) is not shippable. |
| `fast-diff` is too coarse for the change-summary panel | Low | If the output is visibly misleading in eval, fall back to paragraph-level set-diff (remove / added) rather than upgrading to `diff-match-patch`. |

---

## 8. Phasing

See [`Plan2.md`](./Plan2.md) for the detailed phase-by-phase development plan. Phases 8–12 build on the completed Phases 0–7 from [`Plan.md`](./Plan.md). Phase 13 is renamed "Onboarding" and no longer includes a Service Worker; offline mode moves to v2.1.

---

## Appendix — Chrome extension message protocol

The extension communicates with the Powershot web app via `postMessage`:

```typescript
// Extension → Powershot app
interface ExtensionMessage {
  type: 'POWERSHOT_CAPTURE';
  images: Array<{
    dataUrl: string;   // base64 PNG data URL
    title: string;     // e.g., "Visible tab — example.com"
    source: 'visible-tab' | 'region';
  }>;
}

// Powershot app → Extension (acknowledgment)
interface AckMessage {
  type: 'POWERSHOT_CAPTURE_ACK';
  noteId: string;      // ID of the created note
}
```

The `/new` page listens for `POWERSHOT_CAPTURE` messages on `window` and pre-fills the upload surface with the received images.

Appendices covering the PDF hybrid-extraction decision flow and the confidence-marker prompt format have been removed — both features are cut from v2.
