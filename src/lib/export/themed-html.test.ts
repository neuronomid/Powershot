import { describe, expect, it } from "vitest";

import { extractTocItems, buildThemedHtml } from "./themed-html";
import { defaultTheme } from "@/lib/theme/presets";

describe("extractTocItems", () => {
  it("extracts headings depth 1–3 and ignores deeper", () => {
    const md = `# First
## Second
### Third
#### Fourth
## Another Second
`;
    const items = extractTocItems(md);
    expect(items).toEqual([
      { text: "First", slug: "first", depth: 1 },
      { text: "Second", slug: "second", depth: 2 },
      { text: "Third", slug: "third", depth: 3 },
      { text: "Another Second", slug: "another-second", depth: 2 },
    ]);
  });

  it("deduplicates slugs like github-slugger", () => {
    const md = `# Same
## Same
`;
    const items = extractTocItems(md);
    expect(items).toEqual([
      { text: "Same", slug: "same", depth: 1 },
      { text: "Same", slug: "same-1", depth: 2 },
    ]);
  });

  it("returns empty array when no headings", () => {
    expect(extractTocItems("Just some text.")).toEqual([]);
  });
});

describe("buildThemedHtml", () => {
  it("includes TOC when includeToc is true and there are 3+ headings", async () => {
    const markdown = "# A\n## B\n### C\n";
    const html = buildThemedHtml({
      title: "Test",
      bodyHtml: "<p>body</p>",
      markdown,
      theme: { ...defaultTheme, includeToc: true },
    });
    expect(html).toContain("Table of Contents");
    expect(html).toContain('href="#a"');
    expect(html).toContain('href="#b"');
    expect(html).toContain('href="#c"');
  });

  it("omits TOC when includeToc is false", async () => {
    const markdown = "# A\n## B\n### C\n";
    const html = buildThemedHtml({
      title: "Test",
      bodyHtml: "<p>body</p>",
      markdown,
      theme: { ...defaultTheme, includeToc: false },
    });
    expect(html).not.toContain("Table of Contents");
  });

  it("omits TOC when fewer than 3 headings", async () => {
    const markdown = "# A\n## B\n";
    const html = buildThemedHtml({
      title: "Test",
      bodyHtml: "<p>body</p>",
      markdown,
      theme: { ...defaultTheme, includeToc: true },
    });
    expect(html).not.toContain("Table of Contents");
  });

  it("includes footer when includeFooter is true", async () => {
    const html = buildThemedHtml({
      title: "Test",
      bodyHtml: "<p>body</p>",
      markdown: "# A\n",
      theme: { ...defaultTheme, includeFooter: true },
    });
    expect(html).toContain("Made with Powershot");
  });

  it("omits footer when includeFooter is false", async () => {
    const html = buildThemedHtml({
      title: "Test",
      bodyHtml: "<p>body</p>",
      markdown: "# A\n",
      theme: { ...defaultTheme, includeFooter: false },
    });
    expect(html).not.toContain("Made with Powershot");
  });

  it("applies margins via @page CSS", async () => {
    const html = buildThemedHtml({
      title: "Test",
      bodyHtml: "<p>body</p>",
      markdown: "# A\n",
      theme: { ...defaultTheme, margins: "narrow" },
    });
    expect(html).toContain("margin: 15mm;");
  });
});
