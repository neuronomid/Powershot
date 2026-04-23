# Powershot — Product Requirements Document

**Version:** 1.0
**Date:** April 22, 2026
**Status:** Draft for review

---

## 1. Summary

Powershot is a web application that turns a stack of screenshots into a clean, structured, downloadable note. The user gives the note a title, drops in screenshots (in any order), and the app extracts the text while preserving the original visual hierarchy — headers stay headers, bullets stay bullets, tables stay tables — then hands back a polished PDF and DOCX. The app never rephrases or adds words of its own; it only rearranges, de-duplicates, and formats what's already in the image.

The core bet is that a two-model pipeline (a vision model for extraction + a fast text model for reasoning and cleanup) produces dramatically better structural fidelity than traditional OCR, at a cost per note that's low enough to run without rate limits in v1.

## 2. Goals and non-goals

### Goals

- Convert ordered or unordered screenshot batches into a single, hierarchically accurate note.
- Preserve source text verbatim — no paraphrasing, no invented content.
- Correctly detect screenshot order without user intervention in the common case, with an easy override when wrong.
- Export to PDF and DOCX with customizable theme, fonts, and font sizes.
- Support fast, low-friction capture flows (paste, drag-drop, bulk upload).
- Ship on Vercel with a modern Next.js stack.

### Non-goals for v1

- User accounts and persistent cloud-stored note libraries (planned for a later phase).
- Non-English languages.
- Handwriting recognition.
- Collaborative editing.
- Mobile-native apps.
- Upload size or batch size limits (deferred; revisit if abuse appears).

## 3. Target users and primary use cases

The primary user is someone who has captured a series of screenshots from an article, PDF viewer, Slack thread, lecture slide, or documentation site and wants a single searchable document without manually retyping. Core use cases:

- A student screenshotting lecture slides and wanting a Word doc to study from.
- A researcher capturing pages of a paywalled or screen-locked document.
- A professional stitching together a long conversation or spec into one shareable file.
- Anyone who has "15 screenshots and needs to send a clean summary."

## 4. Core user flow

1. User lands on the home screen and clicks **+ New**.
2. User types a note title.
3. User adds screenshots via drag-drop, file picker, or Cmd+V paste.
4. The app auto-detects the intended order and shows a reorder preview with thumbnail strips. User confirms or drags to reorder.
5. User clicks **Generate**. A progress indicator shows per-image status (queued → extracting → reviewing → done).
6. A split-pane preview appears: extracted Markdown on the right, source images on the left, synchronized on scroll.
7. User can inline-edit the Markdown to correct any extraction errors.
8. User picks theme, font, and font size (or keeps defaults) and clicks **Download PDF** and/or **Download DOCX**.
9. User can **Continue this note** to append more screenshots later, or start a new note.

## 5. Functional requirements

### 5.1 Upload

- **Drag-and-drop** onto a full-screen drop zone. Accepts PNG, JPG, JPEG, WebP, HEIC.
- **File picker** via standard input element.
- **Clipboard paste** via Cmd+V / Ctrl+V anywhere on the New Note page. Pasted images are named with the paste timestamp.
- **Bulk selection** supported (user can shift-select many files).
- Client-side validation rejects non-image files with an inline error.
- A live thumbnail grid appears as images are added, with a remove (×) button on each.

### 5.2 Ordering

The app infers chronological order — oldest to newest — using the following priority cascade:

1. **Filename timestamp parsing.** Regex matchers for common screenshot naming patterns:
   - macOS: `Screenshot 2026-04-22 at 14.32.05.png`, `Screen Shot 2026-04-22 at 2.32.05 PM.png`
   - Android: `Screenshot_20260422_143205.png`, `Screenshot_2026-04-22-14-32-05.png`
   - iOS: `IMG_20260422_143205.jpg`
   - Windows: `Screenshot 2026-04-22 143205.png`
   - Generic ISO-like patterns as a fallback.
2. **EXIF metadata** via the `exifr` library — `DateTimeOriginal` or `CreateDate` tags. Usually stripped from screenshots but present on phone photos.
3. **File.lastModified** from the File API. Reliable on most browsers for files originating from the user's disk.
4. **User-supplied order** as the final fallback (i.e., the order they were added).

After inference, the app shows a **reorder preview**: a horizontal filmstrip of each screenshot's top ~120px, rendered via a canvas crop, with the filename and detected timestamp beneath each. The user can drag to reorder. A "Reset to auto-detected" link reverts.

When ordering confidence is low (multiple images with no parseable timestamp or EXIF and identical lastModified), a small warning banner recommends the user double-check the order.

### 5.3 Text extraction (VLM pass)

Each ordered screenshot is sent to a vision-capable model via **OpenRouter** (primary model: Gemini 2.5 Pro; Flash as a lower-cost fallback). The prompt instructs the model to:

- Output **GitHub-Flavored Markdown only**.
- Preserve visual hierarchy: largest/boldest text becomes `#`, the next level `##`, and so on.
- Convert bulleted lists into `-` lists, preserving indentation for nested bullets.
- Convert numbered lists into `1.` form, preserving source numbering.
- Convert tables into Markdown tables (`| col | col |` with header separator), preserving every cell verbatim.
- Preserve inline emphasis (bold, italic) where visually obvious.
- **Never invent, paraphrase, or "correct" words.** Return text exactly as shown, including typos.
- Return a bare empty string for images that contain no text.

Images are sent as base64 inline in the API request. No persistent storage is used. Extraction happens one image per serverless function invocation to stay within Vercel's payload limits and to allow per-image progress updates via streaming.

### 5.4 Deduplication of overlapping content

Screenshots taken while scrolling often overlap at the seam. Dedup runs in two stages:

1. **Deterministic stage (hardcoded).** For each adjacent pair of extracted Markdown chunks, compute the longest common suffix/prefix of normalized text (whitespace-collapsed, case-insensitive). If the match exceeds a threshold (e.g., 60 characters or 2 full lines), remove the overlap from the later chunk. This catches exact seam overlaps cheaply and without an LLM call.
2. **Semantic stage (LLM).** Adjacent chunks are passed in pairs to **Gemini 2.5 Flash** with instructions to identify any remaining semantic overlap — the same paragraph reformatted across the seam, partial headings repeated, etc. — and to mark the overlapping region for removal. The model is explicitly forbidden from rewriting; it only returns deletion spans.

### 5.5 Reasoning and cleanup pass (LLM review)

After extraction and dedup, the full concatenated Markdown is passed to **Gemini 2.5 Flash** with a structural review prompt:

- Do the header levels form a sensible hierarchy (no orphan `###` under nothing, for example)?
- Do bullets visually grouped with a header remain attached to that header in the Markdown?
- Does the ordering between chunks still make sense, or does a section appear to start mid-sentence suggesting a mis-ordered screenshot?
- Are any tables broken across chunks and should be rejoined?

The model may **rearrange, regroup, adjust header levels, and rejoin split tables**, but it must not add, remove, or reword any user-visible content. The prompt enforces this hard constraint with a post-check: the model also returns the set of all word tokens it used in its output, and the backend verifies that set is a subset of the input tokens (a soft guardrail — flagged, not blocked, if violated).

If the review pass detects probable misordering between specific chunks, it emits a warning that is surfaced in the preview UI ("Screenshots 4 and 5 may be out of order").

### 5.6 Preview and edit

A two-pane preview screen:

- **Left:** source images in a scrollable column, in their final order.
- **Right:** rendered Markdown in an editable rich view (Tiptap or equivalent, configured to output Markdown).
- Scroll is **synchronized**: scrolling the Markdown scrolls the left pane to the source image that produced the visible section (anchored by per-chunk offsets recorded during extraction).
- The user can edit the Markdown inline before export. A "Revert to extracted" button restores the original.

### 5.7 Export

Two export formats, both generated server-side on demand:

- **PDF.** Markdown is rendered to HTML (via `remark`/`rehype`), styled with the selected theme/font/size, and printed to PDF using Puppeteer with `@sparticuz/chromium` on Vercel serverless.
- **DOCX.** Markdown is converted to DOCX via the `docx` npm library, with styles mapped to Word's native heading and body styles so the document remains editable in Word with proper outline navigation. Tables are generated as real Word tables, not images.

Both exports preserve:

- Heading structure (mapped to H1–H6 / Heading 1–6).
- Bulleted and numbered lists.
- Tables with proper rows, columns, and cell content.
- Bold and italic emphasis.

### 5.8 Theme and typography customization

A settings panel on the preview screen offers:

- **Theme presets:** Classic (white/black, serif body), Modern (white/black, sans body), Sepia, Minimal.
- **Body font:** curated list (Inter, IBM Plex Sans, Georgia, Merriweather, Source Serif, JetBrains Mono for code).
- **Heading font:** same curated list, independently selectable.
- **Base font size:** Small (10pt), Medium (11pt), Large (12pt), X-Large (14pt). Heading sizes scale proportionally.
- **Line spacing:** 1.15, 1.5, 2.0.

Settings are applied at export time and persisted in `localStorage` so the user's preferred theme is remembered.

### 5.9 Continue from previous note

A persistent local history (stored in `localStorage` or `IndexedDB` — no server, no account) lists the user's recent notes by title and date. Selecting one opens its Markdown in the editor, and the user can add more screenshots, which are extracted and appended to the end of the existing note. All previous customization is retained.

### 5.10 Progress indicators

During generation, a progress panel shows each image in a list with a per-image status:

- ⏳ Queued
- 🔍 Extracting (VLM call in flight)
- ✨ Reviewing (Flash pass in flight)
- ✅ Done
- ⚠️ Failed (with retry button)

Updates stream from the server via Server-Sent Events or a similar mechanism. A single failed image does not block the others; the user sees partial results as they complete.

### 5.11 Privacy

- Images are held only in memory and in transit. Nothing is written to disk or to Vercel Blob.
- No logs retain image data; logs only retain request IDs, timing, and error categories.
- Markdown output is stored locally in the user's browser (`localStorage` / `IndexedDB`), never server-side.
- The privacy policy states this explicitly and is linked from the footer.

## 6. Technical architecture

### 6.1 Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui for primitives, Tiptap for the Markdown editor, `react-dropzone` for uploads, `exifr` for EXIF parsing.
- **Backend:** Next.js API routes (Node runtime for OpenRouter and Puppeteer routes that can exceed Vercel Edge's 25 s initial-response limit; Edge runtime for lightweight proxy routes).
- **AI:** OpenRouter as the model gateway.
  - Extraction: `google/gemini-2.5-pro` (or latest equivalent) for vision.
  - Review and dedup: `google/gemini-2.5-flash` for cost-efficient reasoning.
- **Export:**
  - PDF: `puppeteer-core` + `@sparticuz/chromium`.
  - DOCX: `docx` npm package.
  - Markdown → HTML: `remark` + `remark-gfm` + `rehype-stringify`.
- **Hosting:** Vercel.
- **Local storage:** `IndexedDB` via `idb` for note history; `localStorage` for user preferences.

### 6.2 Data flow

```
Client                                       Server                          OpenRouter
───────                                      ───────                         ──────────
Upload images ──┐
Parse order ────┤ (all client-side)
Confirm order ──┘
    │
    │ POST /api/extract (one image, streamed)
    │──────────────────────────────────────────▶ Gemini 2.5 Pro (vision)
    │                                              │
    │◀─────────────────────────────────── Markdown ┘
    │  (repeated for each image, parallelized)
    │
    │ POST /api/review (full concatenated Markdown)
    │──────────────────────────────────────────▶ Gemini 2.5 Flash
    │                                              │
    │◀──────────────────────── Cleaned Markdown + warnings
    │
    │ (user edits in preview)
    │
    │ POST /api/export?format=pdf|docx
    │──────────────────────────────────────────▶ Puppeteer / docx lib
    │◀─────────────────────────── File stream
```

### 6.3 Per-image extraction payload

Each image is sent separately to avoid Vercel's 4.5 MB request body limit on serverless functions and to enable streaming progress. Client orchestrates the parallel calls (with a concurrency cap of ~4 to avoid rate-limit spikes).

### 6.4 Cost model (rough)

- Gemini 2.5 Pro via OpenRouter: ~$0.00125–0.005 per screenshot depending on size.
- Gemini 2.5 Flash review pass: ~$0.0002 per 1k tokens of note content.
- Expected per-note cost at 20 screenshots: **under $0.10**. Sustainable without rate limits during early usage; revisit if volume explodes.

## 7. UX and visual design direction

- Modern, minimal aesthetic. Off-white backgrounds, generous whitespace, subtle borders, rounded-xl corners, quiet shadows.
- Typography-forward: the hero on the home screen is large, confident display type with a single CTA.
- Micro-interactions: smooth drag animations on reorder, spring physics on drop, skeleton shimmer while extracting, a satisfying checkmark animation per image when done.
- Dark mode supported in the app UI. PDF/DOCX exports are always light-themed by default (user can pick Sepia or dark-text-on-light themes for export, but not true dark exports — print-unfriendly).
- No stock illustrations, no gradients-for-gradients'-sake. Lean editorial, not SaaSy.

## 8. Non-functional requirements

- **Performance target:** 20-screenshot note generated end-to-end in under 60 seconds on a typical broadband connection.
- **Reliability:** per-image extraction failures do not block the batch; user can retry individual images.
- **Accessibility:** WCAG AA on UI. Keyboard-navigable upload, reorder (arrow-key reordering as alternative to drag), preview, and export.
- **Browser support:** current Chrome, Safari, Firefox, Edge. Cmd+V paste must work in all four.
- **Privacy:** zero server-side persistence of image or extracted text data.

## 9. Success metrics

- **Extraction fidelity:** manual eval on a 50-note benchmark set, measuring (a) exact-word recall, (b) structural accuracy (correct header level assignment), (c) table cell accuracy. Target ≥ 95% exact-word recall, ≥ 90% structural accuracy.
- **Ordering accuracy:** on a set of 100 unordered bulk uploads with known correct order, the auto-detected order matches ≥ 95% of the time.
- **Time to export:** median < 45 seconds for a 10-image note.
- **User-reported corrections:** average number of edits the user makes in the preview pane before exporting — minimize this over time.

## 10. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| VLM invents or paraphrases words despite instruction | Medium | Flash review pass with token-subset guardrail; prominent preview with easy edit; clear "the model may make mistakes — please review" messaging. |
| Screenshot order undetectable (all same mtime, no EXIF, generic filenames) | Medium | Prominent "confirm order" step is already mandatory; thumbnail strip gives the user a quick visual check. |
| Overlapping screenshots produce duplicated or missing text | Medium | Two-stage dedup (deterministic + semantic); preview pane lets user see and fix. |
| Vercel serverless function timeouts on large batches | Low | Per-image parallel calls with concurrency cap; OpenRouter and export routes run in Node runtime with extended timeout; client orchestrates so no single function call exceeds the configured serverless budget. |
| OpenRouter outage or Gemini rate limits | Low | Fallback model chain (Pro → Flash → Claude Haiku) configured in OpenRouter; user-facing retry on failure. |
| Puppeteer on Vercel is fragile | Medium | Use the well-maintained `@sparticuz/chromium` package; have a fallback path that generates PDF from DOCX via a lightweight converter if Puppeteer fails. |
| Users upload sensitive documents and worry about privacy | High (perception) | Zero-retention architecture + explicit, readable privacy statement linked from every page. |

## 11. Open questions

- **Pro/Flash model choice:** worth A/B-testing Gemini 2.5 Pro vs Flash for the *extraction* pass; Flash may be good enough and 10× cheaper. Decide empirically after launch.
- **Table extraction for complex tables:** merged cells and nested tables may not survive the Markdown round trip. Acceptable for v1 to degrade gracefully (merged cells → separate cells with repeated content) but worth flagging to the user when detected.
- **Max practical batch size:** no hard limit in v1, but at some point (~50+ images) the UX gets awkward. Monitor and add a soft warning if needed.
- **Image storage for "continue note" flow:** currently the source images aren't persisted, so the "continue" flow only appends new Markdown. If users want to re-review original sources after closing the tab, we'd need optional IndexedDB image caching. Deferred to v1.1 pending demand.

## 12. Phasing

### Phase 1 — MVP (this PRD)
All of Section 5. Goal: a user can go from screenshots to a downloadable, well-structured PDF/DOCX in one session.

### Phase 2 — Refinement
- Accounts and cloud-synced note history.
- Image persistence for the continue-note flow.
- Shareable read-only note links.

### Phase 3 — Expansion
- Multilingual support (starting with Spanish, French, German).
- Handwriting support.
- Mobile PWA with native-like camera capture flow.
- Browser extension for one-click "screenshot this page to Powershot."

---

## Appendix A — Filename timestamp patterns (for reference)

```
macOS:    /Screen ?[Ss]hot (\d{4}-\d{2}-\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})( [AP]M)?/
Android:  /Screenshot_(\d{4})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})/
          /Screenshot_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/
iOS:      /IMG_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/
Windows:  /Screenshot (\d{4}-\d{2}-\d{2}) (\d{6})/
Generic:  /(\d{4})[-_]?(\d{2})[-_]?(\d{2})[T_ ]?(\d{2})[-:]?(\d{2})[-:]?(\d{2})/
```

## Appendix B — Extraction prompt sketch

```
You are extracting text from a screenshot into Markdown.

HARD RULES:
1. Output only Markdown. No prose, no preamble, no commentary.
2. Never add, remove, paraphrase, or "correct" any word. Preserve typos.
3. Match the visual hierarchy of the source:
   - Largest or boldest titles → # or ##
   - Section headers → ## or ###
   - Sub-headers → ### or ####
4. Bullets → "- ". Nested bullets indented by 2 spaces.
5. Numbered lists → "1. ", preserving source numbering.
6. Tables → GFM Markdown tables. Every cell verbatim.
7. Preserve **bold** and *italic* where visually obvious.
8. If the image has no text, output an empty response.
9. Do not describe images, icons, or UI chrome unless they contain text.
```

## Appendix C — Review pass prompt sketch

```
You are reviewing a Markdown document assembled from sequential screenshots.

You MAY:
- Adjust header levels so the hierarchy is sensible.
- Regroup bullets under their correct parent header when the original extraction got them wrong.
- Rejoin tables that were split across screenshot boundaries.
- Flag pairs of sections that appear to be in the wrong order.

You MUST NOT:
- Add any word that is not already in the input.
- Remove any content-bearing word. (You may remove duplicate overlap regions.)
- Paraphrase or "improve" wording.
- Correct spelling or grammar.

Return:
1. The revised Markdown.
2. A JSON array of ordering warnings, each with {after_chunk, before_chunk, reason}.
```
