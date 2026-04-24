import { describe, expect, it } from "vitest";

import {
  FLASHCARD_DEDUP_SYSTEM_PROMPT,
  FLASHCARD_SYSTEM_PROMPT,
} from "./prompts";
import { ALL_FLASHCARD_STYLES } from "@/lib/flashcard/types";

describe("flashcard prompts", () => {
  it("keeps the Plan3 answer-subset and no-invention rules load-bearing", () => {
    expect(FLASHCARD_SYSTEM_PROMPT).toContain("Every answer");
    expect(FLASHCARD_SYSTEM_PROMPT).toContain("must consist of words that already appear");
    expect(FLASHCARD_SYSTEM_PROMPT).toContain("Paraphrasing questions is OK");
    expect(FLASHCARD_SYSTEM_PROMPT).toContain("paraphrasing answers is NOT OK");
    expect(FLASHCARD_SYSTEM_PROMPT).toContain("Do not invent facts");
  });

  it("documents all ten user-facing styles and the two Anki note models", () => {
    for (const style of ALL_FLASHCARD_STYLES) {
      expect(FLASHCARD_SYSTEM_PROMPT).toContain(style);
    }
    expect(FLASHCARD_SYSTEM_PROMPT).toContain('"model": "basic" | "cloze"');
    expect(FLASHCARD_SYSTEM_PROMPT).toContain("{{c1::...}}");
  });

  it("keeps dedup as deletion-index detection without rewrites", () => {
    expect(FLASHCARD_DEDUP_SYSTEM_PROMPT).toContain("semantic duplicates");
    expect(FLASHCARD_DEDUP_SYSTEM_PROMPT).toContain("duplicateIndices");
    expect(FLASHCARD_DEDUP_SYSTEM_PROMPT).toContain("No commentary");
    expect(FLASHCARD_DEDUP_SYSTEM_PROMPT).not.toContain("rewrite");
  });
});
