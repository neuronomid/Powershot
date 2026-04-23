# Powershot v2 — Development Plan

**Version:** 2.1 (revised 2026-04-23 after audit)
**Date:** April 23, 2026
**Companion to:** [`PRD2.md`](./PRD2.md) (v2 PRD), [`Plan.md`](./Plan.md) (v1 plan)

---

## Context

`PRD2.md` defines *what* Powershot v2 must do. This plan defines *how* v2 gets built: a sequence of development phases (8–12), each ending at a demoable, testable milestone. Phases 8–12 build on the completed Phases 0–7 from `Plan.md`.

This plan was revised after an audit of the v2 draft. Several original v2 features (confidence coloring, auto math/code classification, token-level SSE streaming, PDF native-text hybrid, Firefox extension, full-page capture, Service Worker) were cut from v2 or deferred to v2.1 because they risked misleading users, degrading extraction quality, or consuming disproportionate engineering cost. See PRD2 §§3.4, 3.6, 3.8, 3.11, 3.16, 3.18 for specifics.

### Guiding principles (unchanged from v1)

1. **De-risk unknowns early.** New integrations (PDF rendering, Chrome extension) are proven before polish.
2. **Each phase is a vertical slice.** Every phase ends with something a user can actually use.
3. **Strict adherence to privacy constraints.** No new server-side persistence of images or note data. The browser extension sends images client-side via `postMessage`, never to a separate server.
4. **Fidelity-harness regression gate.** Any change that touches extraction prompts or pre-processing must clear the v1 fidelity harness with no regression.

### Phase numbering

Phases 8–12 continue from the completed Phases 0–7 in `Plan.md`. Phase N depends on Phase N-1 being complete and demoable.

The original plan had a Phase 13 that bundled onboarding with a Service Worker. Phase 13 is removed; the onboarding half moves into Phase 12 (extension + onboarding can ship together — both touch the `/new` page pre-fill mechanism). Offline / Service Worker is reclassified as v2.1.

---

## Phase 8 — Production hardening & editor fundamentals

**Goal:** The app is safe to share publicly; core editor UX matches professional expectations.

**Scope (in):**
- **Rate limiting** (PRD2 §3.19): Per-IP distributed rate limiting on all API routes using Vercel KV (or Upstash Redis). Configurable limits per route. `429` responses with `Retry-After` header. **No in-memory limiter fallback** — serverless lambdas don't share memory, so an in-memory counter enforces nothing.
- **Request-size validation**: Reject request bodies > 5 MB in route middleware before the AI call.
- **Image count cap**: Maximum 30 images per batch. Upload surface disables after 30 with a message.
- **Undo/redo** (PRD2 §3.1): Enable Tiptap's `History` extension. `Cmd+Z` / `Cmd+Shift+Z` with 100-step stack. "Revert to extracted" clears history and resets.
- **Debounced auto-save** (PRD2 §3.1): IndexedDB writes debounced to 1 second after last keystroke. "Saved" indicator fades in 500 ms after write, disappears after 2 seconds. Flush on `beforeunload`.
- **Copy Markdown to clipboard** (PRD2 §3.2): "Copy" button copies `text/plain` (raw Markdown) by default. Secondary "Copy as rich text" option writes dual `text/plain` + `text/html`. Confirmation toast. Graceful degradation if Clipboard API unavailable.
- **Note search** (PRD2 §3.3): Search input on home page (visible when ≥ 3 notes). Client-side `includes()` matching over title + markdown. Real-time filtering. **Session-only — does not persist across reloads.**
- **Custom 404 and error pages**: `not-found.tsx` and `error.tsx` at the app level with on-brand styling.

**Scope (out):** diff view / review-change summary; PDF upload; pre-processing; crop; export improvements; browser extension; onboarding.

**Deliverable:** A deployed app where a new visitor can't abuse the API, editor undo/redo works, notes auto-save without write amplification, text copies cleanly to clipboard as plain Markdown, and notes are searchable.

**Key risks:**
- **Vercel KV / Upstash requires a paid plan tier and adds a runtime dependency.** Mitigation: budget the monthly line item. This is unavoidable cost — the alternative (no rate limiting on public launch) is not shippable.
- **Tiptap History extension** may conflict with `tiptap-markdown` serialization. Mitigation: verify in Phase 8 that undo/redo round-trips correctly with Markdown output.
- **Clipboard API** requires a secure context (HTTPS). Mitigation: Vercel provides HTTPS by default. Fallback to `document.execCommand('copy')` with plain text only in development (HTTP).
- **Dual-format clipboard confuses host apps.** Mitigation: plain-text is the default action; rich-text is an explicit secondary option.

**Constraints:**
- Rate-limit configuration lives in `src/lib/rate-limit.ts` as constants, not env vars.
- Image count cap is enforced client-side (upload surface) and server-side (API validation).
- Search state is React state only — no `localStorage` read/write.

**Depends on:** Phases 0–7 (complete).

---

## Phase 9 — Pipeline transparency (reshaped)

**Goal:** Users see and understand what the review pass changed, and know which model handled each image. Trust is earned through honest, low-false-positive signals.

**Scope (in):**
- **Batch progress bar + ETA** (PRD2 §3.4): Determinate horizontal progress bar at the top of the pipeline panel with a weighted fill (extraction 70% / dedup 10% / review 20%, in-flight images counted at half weight for smooth motion). Short text label per stage ("Extracting 7 of 20 images…", "Finding overlaps…", "Reviewing for structure…"). Rough ETA appears after the 3rd completed image, based on median per-image extraction time observed in this batch; never allowed to shrink-then-grow. Suppressed for single-image runs (spinner only). Per-image status pills from v1 remain in the filmstrip.
- **Review-change summary** (PRD2 §3.5, §3.21): After the review pass completes, compute a lightweight diff between pre- and post-review Markdown using `fast-diff`. Render a collapsible panel above the editor listing **removed passages** (short quoted snippets) and **reordered blocks** (paragraph-level move detection via anchor matching). If no removals and no moves, the panel collapses to a muted "Review made no structural changes" caption. **No green/red word-level highlighting** — too noisy under the token-subset guardrail.
- **Model fallback badges** (PRD2 §3.7): Surface the `model` field from extraction responses as a **neutral per-image text badge** in the image pane ("Gemini 2.5 Pro", "Gemini 2.5 Flash", "Claude Haiku 4.5"). No red/amber/green color coding. Show a small info icon + tooltip when the image fell back from the primary model. When any image in the note used a fallback, show a single dismissible info banner at the top of the editor. Persist `model` in `ChunkMeta` in IndexedDB.

**Explicitly NOT in this phase (cut or deferred):**
- **SSE streaming extraction** — deferred to v2.1. The "text materializing" UX win is already captured by per-image progress with concurrency 4. Token-level streaming adds SSE plumbing, retry complexity, and a partial-text-vanishes-on-failure UX trap without a commensurate benefit.
- **Confidence coloring** — cut entirely. Model-reported confidence is poorly calibrated and painting red/amber/green borders based on unreliable self-reports would mislead users.

**Scope (out):** PDF upload; pre-processing; crop; math/code detection; export improvements; browser extension; onboarding.

**Deliverable:** A user sees a plain-English summary of what the review pass removed and reordered, and can see at a glance which images were handled by which model. Both signals are honest and have low false-positive rates.

**Key risks:**
- **ETA jitter undermines the psychological win.** If the remaining-time estimate bounces or shrinks-then-grows, it feels worse than no estimate. Mitigation: base the estimate on the median (not mean) of completed images, and clamp it to non-decreasing motion — if the new estimate is higher, hold the displayed value until real elapsed time catches up.
- **Progress bar desync across dedup/review transitions.** Dedup and review are single calls, so their weight lands in one step; combined with per-image smoothing, the bar can appear to pause. Mitigation: animate dedup/review slices with a 1-second ease-in fill rather than a snap, so the bar keeps moving even when the underlying work is binary.
- **Paragraph-level move detection produces false positives on trivial whitespace shifts.** Mitigation: ignore hunks whose post-trim character count is < 3. If still noisy in dogfooding, fall back to paragraph-level set-diff (only "removed" and "added" categories, no move detection).
- **Users don't know what "review" means.** Mitigation: a one-line explainer above the panel: "Review removed duplicates and restructured sections without rewording text. Here's what changed."
- **`fast-diff` granularity.** It's a plain-text diff, not semantic. For our narrow use (detect whole-paragraph deletions + moves) this is fine. Do not upgrade to `diff-match-patch` — the bundle hit isn't justified.

**Constraints:**
- The change summary is computed client-side and stored in memory only — not persisted to IndexedDB.
- Badge rendering must not shift layout. The model badge lives in a fixed-width chip within the image pane.

**Depends on:** Phase 8.

---

## Phase 10 — Smarter input

**Goal:** More input types and more control over what gets extracted. Pre-processing improvements are shipped conservatively (opt-in) with an eval gate before any default changes.

**Scope (in):**
- **PDF upload — VLM path only** (PRD2 §3.8): Accept `.pdf` files in the upload surface. Use `pdfjs-dist` (lazy-loaded, worker in separate chunk) to render each page to a canvas image at the same 1600px max / JPEG 85% as the existing resize pipeline. **Every page routes through the existing VLM extraction pipeline.** No native-text-layer → Markdown structure inference (deferred to v2.1). PDF pages appear in the filmstrip with a PDF icon overlay and "Page N" label. Warning for > 50 pages.
- **EXIF auto-rotation** (PRD2 §3.9): Always-on, applied before base64 encoding. Fixes phone screenshots with misreported orientation flags.
- **Opt-in image enhancement** (PRD2 §3.9): Single "Enhance faint screenshots" toggle in the upload surface (**default off**). When on, applies contrast stretch (histogram normalization) and mild unsharp mask (radius 1.0, amount 0.3) to each image before extraction. "Enhanced" badge on affected filmstrip thumbnails. Original preserved in the image pane for reference. Toggle state persists in `localStorage`. Before flipping the default to on in v2.1, require the fidelity harness to show no regression on the existing fixture set.
- **Region-select crop** (PRD2 §3.10): "Crop" button on each filmstrip image. Opens a rectangular selection overlay with drag handles on corners and edges. "Apply" replaces the extraction region with the cropped area; original is preserved for context in the image pane. "Reset crop" restores the full image. Crop state stored per-image in `StagedImage`. Keyboard support: arrow keys resize, Shift+arrow moves, Enter applies, Escape cancels.
- **Manual math / code re-extraction** (PRD2 §3.11): Per-image "Re-extract as…" menu with **Code** and **Math** options. Choosing one re-runs extraction for that image only, using a specialized prompt. Replaces the chunk in place.

**Explicitly NOT in this phase (cut or deferred):**
- **PDF native-text hybrid path** — deferred to v2.1. Font-size-based heading inference and grid-based table inference are tar pits; the VLM path gives us one extraction quality to reason about.
- **Automatic math/code classification** — cut. Extra Flash call per chunk adds cost/latency; classifier false positives on mixed content; silent replacement of extractions is a confusing UX. Manual override is the high-value 20%.
- **Default-on sharpen/contrast** — opt-in only until fidelity harness clears it.

**Scope (out):** export improvements; browser extension; onboarding.

**Deliverable:** A user uploads a PDF and gets per-page VLM extraction. Users with faint screenshots can opt into enhancement. Users can crop away sidebars and ads. Users can manually re-extract a code screenshot as fenced code or a math screenshot as LaTeX.

**Key risks:**
- **`pdfjs-dist` is large (~2.5 MB).** Mitigation: lazy-load only when a PDF file is detected. Dynamic `import()` + Web Worker for rendering.
- **Opt-in enhancement might not move the quality needle.** Mitigation: this is a known risk of the conservative approach. Instrument (client-side only, no telemetry) whether enhance-enabled sessions have lower edit rates; use that data to decide v2.1 defaults.
- **Crop overlay accessibility.** Mitigation: keyboard support as specified above. Screen reader announcements for crop dimensions.
- **Manual re-extraction cost.** Mitigation: re-extraction only runs when the user clicks. Rate limited like a normal extraction call.

**Constraints:**
- PDF processing happens entirely client-side. No PDF files are sent to the server — only the rendered page images.
- `pdfjs-dist` worker must be loaded as a separate chunk (not inlined into the main bundle).
- Crop coordinates are stored as pixel ratios (0–1 range) in `StagedImage` so they survive image resizing.
- Enhancement is applied before base64 encoding. Base64 payload may be slightly larger post-sharpen; JPEG compression absorbs this.

**Depends on:** Phase 9 (review-change summary is useful context when evaluating PDF-page extractions and enhancement behavior).

---

## Phase 11 — Export mastery

**Goal:** Professional-grade export options that cover every common need.

**Scope (in):**
- **Markdown download** (PRD2 §3.12): "Download Markdown" button in the theme panel. Generates a `.md` file with the note title as filename. Raw Markdown content only.
- **Table of contents** (PRD2 §3.13): Auto-generated TOC for notes with ≥ 3 headings. PDF: TOC section at the top with heading text as clickable internal `#anchor` links (no page numbers in v2 — page numbers need a two-pass Puppeteer render that's fragile on serverless; deferred to v2.1). DOCX: Word-native TOC field (`TOC \o "1-3" \h \z \u`). Markdown: skip (MD tooling has its own conventions). Only `#` through `###` included. Toggle in theme panel: "Include table of contents" (default on for qualifying notes, persisted).
- **Custom page sizes and margins** (PRD2 §3.14): Page size selector (US Letter, A4, A5) and margins (Narrow 15mm, Standard 25mm, Wide 35mm) in the theme panel. Applied to PDF (`page.pdf()` options) and DOCX (page dimensions in `docx` library). Persisted in `localStorage` as part of theme preferences.
- **"Made with Powershot" opt-in footer** (PRD2 §3.15): Toggle in theme panel: "Add 'Made with Powershot' footer" (default off). When on, appends a small 8pt footer to PDF, DOCX, and Markdown exports.   Text: "— Made with Powershot | powershot.org". Persisted as part of theme preferences.

**Scope (out):** browser extension; onboarding; pipeline changes.

**Deliverable:** A user downloads a Markdown file, gets a PDF with a TOC and A4 page size, or exports a DOCX with custom margins and a Powershot footer.

**Key risks:**
- **TOC page numbers in Puppeteer are complex.** Mitigation: defer page numbers to v2.1. Single-pass render with `#anchor` links only.
- **Word TOC fields require a manual update in Word.** Mitigation: include a one-line note in the DOCX: "Press Ctrl+A then F9 in Word to refresh the table of contents."
- **PDF page size via CSS `@page size`.** Mitigation: set page size in the Puppeteer `page.pdf()` options (more reliable). Use CSS `@page` for margins only.
- **Existing theme system interactions.** Mitigation: extend the `ExportTheme` type — do not replace. All settings are orthogonal.

**Constraints:**
- TOC in PDF does not include page numbers in v2. Deferred to v2.1.
- The footer text and URL are constants in `src/lib/theme/constants.ts`.
- New theme preferences extend the existing `localStorage` key (`powershot:export-theme`). Migration: defaults applied if new fields are absent.

**Depends on:** Phase 10.

---

## Phase 12 — Chrome extension + onboarding

**Goal:** A Chrome extension eliminates the screenshot loop, and first-time visitors can try the product in one click without bringing their own screenshots.

Bundling these together: both features inject images into the `/new` page via the same `postMessage` / pre-fill mechanism, so shipping them in one phase lets us build that mechanism once.

**Scope (in):**
- **Extension project scaffold**: `extension/` directory at repo root. Vite + TypeScript build. Chrome Manifest V3.
- **Capture modes for v2.0** (PRD2 §3.16):
  - **Visible tab**: `chrome.tabs.captureVisibleTab()`. One click, one image.
  - **Region selection**: Content script injects an overlay where the user drags a rectangle. `captureVisibleTab` + canvas crop.
- **Extension popup UI**: Two buttons (Visible tab, Region) plus an "Open Powershot" link. Light/dark mode matching browser theme.
- **Post-capture flow**: Extension opens `https://[app-url]/new?source=extension`, waits for the tab's `window.onload`, then sends captured images via `postMessage`. The `/new` page listens for `POWERSHOT_CAPTURE` and pre-fills the upload surface. Retry up to 3× with 500 ms backoff if the tab isn't ready.
- **Keyboard shortcut**: `Alt+Shift+S` triggers "Visible tab" capture (avoiding the `Ctrl+Shift+S` collision with Chrome's "Save page as" on Windows/Linux).
- **Chrome Web Store submission**: Icons (16/32/48/128), screenshots, description, privacy policy link.
- **Onboarding with sample note** (PRD2 §3.17): "Try it with a sample" card on the home page when no notes exist. 3–4 pre-loaded sample images (lecture slide, documentation page, Slack conversation, recipe/article), fetched lazily from `/public/samples/` (not base64-bundled). Clicking "Try it" navigates to `/new?sample=true`, pre-fills the upload surface via the same mechanism the extension uses, and auto-starts the pipeline. Samples are marked `transient` and cleaned up after the session. "Start fresh" clears the demo. Card disappears after the first real note.

**Explicitly NOT in this phase (deferred to v2.1):**
- **Full-page scroll-and-stitch capture** — unreliable across CSPs, shadow DOM, fixed headers, infinite-scroll sites. Flagged High risk in the original draft; defer until there's clear user demand.
- **Firefox extension** — separate review process (1–2 weeks), `browser.*` API polyfill complexity. Ship Chrome first, measure demand, then port.

**Scope (out):** Service Worker / offline mode (deferred to v2.1 — see PRD2 §3.18).

**Deliverable:** A user installs the Chrome extension, clicks "Visible tab" or presses `Alt+Shift+S`, and the captured page appears in Powershot's upload surface. Separately, a first-time visitor with no existing notes can click "Try it with a sample" and see a complete end-to-end note appear without uploading anything.

**Key risks:**
- **Extension ↔ web app `postMessage` handshake races.** Mitigation: extension opens the new tab first, then sends on `window.onload`. Retry up to 3× with 500 ms backoff. Content scripts in the `/new` page respond with `POWERSHOT_CAPTURE_ACK`.
- **Chrome Web Store review can take 1–3 business days, occasionally longer.** Mitigation: submit early; plan the store launch around review timing.
- **Extension icon and branding.** Mitigation: design assets are needed before submission. Block-path this out of the engineering critical path.
- **Sample extraction costs real API money for every new visitor.** Mitigation: sample extraction is rate-limited like any other request. Per-visitor cost (~$0.02 for 4 images) is a reasonable customer acquisition cost.
- **Sample images bloat the bundle.** Mitigation: images live in `/public/samples/` and are fetched only when the "Try it" card is rendered.

**Constraints:**
- The extension communicates only via `postMessage`. No shared IndexedDB, no shared localStorage.
- The extension does NOT call Powershot API routes directly. It only captures images and hands them to the web app, which then calls the API. This keeps all rate-limiting and request-size validation in one place.
- Permissions: `activeTab`, `scripting` only. No `tabs`, `history`, `bookmarks`, `downloads`.
- Auto-starting the sample pipeline must be cancellable (reuse the existing `AbortSignal` from the v1 pipeline).

**Depends on:** Phase 11 (the extension and onboarding both inject into the `/new` page; we want a stable, feature-complete `/new` before adding two external producers of images).

---

## Deferred to v2.1+

Tracked here so the intent is not lost:

- **Token-level SSE streaming** for extraction — revisit after we have real data on where users wait.
- **PDF native-text hybrid path** (text-layer → Markdown structure inference) — revisit with real usage data on what PDFs users upload.
- **Default-on image enhancement** — flip default only after the fidelity harness shows no regression.
- **Automatic math/code classification with re-extraction** — revisit if manual override usage patterns justify automation.
- **Full-page scroll-and-stitch extension capture**.
- **Firefox extension port**.
- **Service Worker / offline mode** — revisit if there's evidence users want to use the app offline.
- **PDF TOC with page numbers** (two-pass Puppeteer render).
