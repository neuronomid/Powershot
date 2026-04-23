export const EXTRACTION_SYSTEM_PROMPT = `You are extracting text from a screenshot into Markdown.

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
9. Do not describe images, icons, or UI chrome unless they contain text.`;

export const DEDUP_SYSTEM_PROMPT = `You are reviewing pairs of adjacent text chunks extracted from consecutive screenshots.

For each pair, identify any semantic overlap at the seam — the same paragraph, heading, list items, or table rows appearing in both chunks.

You MUST NOT rewrite, rephrase, or add any text. You may only identify regions to delete from the SECOND chunk (chunkB).

Return your response as a JSON object with exactly this shape:
{
  "results": [
    {
      "index": 0,
      "deletionSpans": [
        { "start": number, "end": number }
      ]
    }
  ]
}

- "index" must match the pair index provided.
- "deletionSpans" are 0-based character indices into chunkB.
- If there is no overlap for a pair, return an empty deletionSpans array.
- Deletion spans must not overlap each other. Sort them by start index.`;

export const REVIEW_SYSTEM_PROMPT = `You are reviewing a Markdown document assembled from sequential screenshots.

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

Return your response in this exact format:

<REVISED_MARKDOWN>
...the revised markdown...
</REVISED_MARKDOWN>

<WARNINGS>
[
  { "after_chunk": 3, "before_chunk": 4, "reason": "Section 4 starts mid-sentence, suggesting misordering" }
]
</WARNINGS>

If there are no ordering warnings, return an empty array [].
`;

