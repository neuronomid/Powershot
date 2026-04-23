import { describe, expect, it } from "vitest";

import { markdownToDocxBuffer } from "./md-to-docx";
import { defaultTheme } from "@/lib/theme/presets";

describe("markdownToDocxBuffer", () => {
  it("generates a non-empty buffer for basic markdown", async () => {
    const buffer = await markdownToDocxBuffer({
      markdown: "# Hello\n\nThis is a test.\n",
      title: "Test",
      theme: defaultTheme,
    });
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("generates a buffer with TOC when includeToc is true and there are 3+ headings", async () => {
    const buffer = await markdownToDocxBuffer({
      markdown: "# A\n## B\n### C\n",
      title: "Test",
      theme: { ...defaultTheme, includeToc: true },
    });
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("generates a buffer with footer when includeFooter is true", async () => {
    const buffer = await markdownToDocxBuffer({
      markdown: "# Hello\n",
      title: "Test",
      theme: { ...defaultTheme, includeFooter: true },
    });
    expect(buffer.length).toBeGreaterThan(0);
  });
});
