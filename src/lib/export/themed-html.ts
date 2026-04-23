import type { ExportTheme } from "@/lib/theme/types";
import {
  BASE_SIZE_PT,
  LINE_SPACING_VAL,
  FONT_CSS,
  FONT_GOOGLE_URL,
  PRESET_COLORS,
  MARGIN_MM,
} from "@/lib/theme/types";
import { FOOTER_TEXT } from "@/lib/theme/constants";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import GithubSlugger from "github-slugger";
import type { Root } from "mdast";

export interface TocItem {
  text: string;
  slug: string;
  depth: number;
}

export function extractTocItems(markdown: string): TocItem[] {
  const parsed = remark().use(remarkGfm).parse(markdown) as Root;
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  for (const node of parsed.children) {
    if (node.type === "heading" && node.depth >= 1 && node.depth <= 3) {
      const text = node.children
        .map((c) =>
          c.type === "text"
            ? c.value
            : c.type === "inlineCode"
              ? c.value
              : "",
        )
        .join("");
      const slug = slugger.slug(text);
      items.push({ text, slug, depth: node.depth });
    }
  }
  return items;
}

function buildTocHtml(items: TocItem[], theme: ExportTheme): string {
  const colors = PRESET_COLORS[theme.preset];
  const basePt = BASE_SIZE_PT[theme.baseSize];
  const h2Pt = basePt * 1.4;
  let html = `<nav class="toc" style="margin-bottom:1.5em;page-break-inside:avoid;">`;
  html += `<h2 class="toc-title" style="font-size:${h2Pt}pt;font-weight:600;margin-bottom:0.5em;font-family:${FONT_CSS[theme.headingFont]};color:${colors.foreground};">Table of Contents</h2>`;
  html += '<ul class="toc-list" style="list-style:none;padding-left:0;margin:0;">';
  for (const item of items) {
    const indent = item.depth === 1 ? 0 : item.depth === 2 ? 1 : 2;
    html += `<li class="toc-item" style="margin-bottom:0.35em;padding-left:${indent}em;"><a href="#${item.slug}" style="text-decoration:none;color:${colors.foreground};">${escapeHtml(item.text)}</a></li>`;
  }
  html += "</ul></nav>";
  return html;
}

export function buildThemedHtml(params: {
  title: string;
  bodyHtml: string;
  markdown: string;
  theme: ExportTheme;
}): string {
  const { title, bodyHtml, markdown, theme } = params;
  const colors = PRESET_COLORS[theme.preset];
  const basePt = BASE_SIZE_PT[theme.baseSize];
  const lineHeight = LINE_SPACING_VAL[theme.lineSpacing];
  const bodyFont = FONT_CSS[theme.bodyFont];
  const headingFont = FONT_CSS[theme.headingFont];
  const marginMm = MARGIN_MM[theme.margins];

  const googleFontUrls = [
    FONT_GOOGLE_URL[theme.bodyFont],
    FONT_GOOGLE_URL[theme.headingFont],
  ]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const fontLinks = googleFontUrls
    .map((url) => `<link rel="stylesheet" href="${url}" />`)
    .join("\n");

  // Heading sizes scale proportionally from base.
  const h1Pt = basePt * 1.75;
  const h2Pt = basePt * 1.4;
  const h3Pt = basePt * 1.2;
  const h4Pt = basePt * 1.1;

  const tocItems = theme.includeToc ? extractTocItems(markdown) : [];
  const tocHtml = tocItems.length >= 3 ? buildTocHtml(tocItems, theme) : "";
  const footerHtml = theme.includeFooter
    ? `<footer class="export-footer" style="margin-top:2em;font-size:8pt;color:${colors.foreground};opacity:0.5;text-align:right;">${escapeHtml(FOOTER_TEXT)}</footer>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  ${fontLinks}
  <style>
    @page {
      margin: ${marginMm}mm;
    }
    body {
      font-family: ${bodyFont};
      font-size: ${basePt}pt;
      line-height: ${lineHeight};
      color: ${colors.foreground};
      background: ${colors.background};
      margin: 0;
      padding: 0;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: ${headingFont};
      color: ${colors.foreground};
      page-break-after: avoid;
      margin-top: 1.2em;
      margin-bottom: 0.5em;
      line-height: 1.25;
    }
    h1 { font-size: ${h1Pt}pt; font-weight: 700; }
    h2 { font-size: ${h2Pt}pt; font-weight: 600; }
    h3 { font-size: ${h3Pt}pt; font-weight: 600; }
    h4 { font-size: ${h4Pt}pt; font-weight: 600; }
    p { margin: 0 0 0.75em 0; orphans: 3; widows: 3; }
    ul, ol { margin: 0 0 0.75em 0; padding-left: 1.5em; }
    li { margin-bottom: 0.25em; }
    blockquote {
      border-left: 3px solid ${colors.accent};
      margin: 0 0 0.75em 0;
      padding-left: 1em;
      color: ${colors.foreground};
      opacity: 0.85;
    }
    pre {
      background: ${colors.muted};
      padding: 0.75em 1em;
      border-radius: 0.35em;
      overflow-x: auto;
      font-size: 0.875em;
      page-break-inside: avoid;
    }
    code {
      background: ${colors.muted};
      padding: 0.15em 0.35em;
      border-radius: 0.25em;
      font-size: 0.875em;
    }
    a { color: ${colors.accent}; text-decoration: underline; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 0.75em;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid ${colors.foreground}20;
      padding: 0.5em 0.75em;
      text-align: left;
    }
    th { background: ${colors.muted}; font-weight: 600; }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid ${colors.foreground}20; margin: 1.5em 0; }
    .toc-item a:hover { text-decoration: underline; color: ${colors.accent}; }
  </style>
</head>
<body>
  ${tocHtml}
  ${bodyHtml}
  ${footerHtml}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
