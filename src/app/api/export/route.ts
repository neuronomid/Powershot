/**
 * Runtime: Node.js (required for puppeteer-core).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import puppeteer, { type PaperFormat } from "puppeteer-core";
import chromium from "@sparticuz/chromium";
import { existsSync } from "node:fs";
import { join } from "node:path";

import { markdownToHtml } from "@/lib/export/markdown-to-html";
import { buildThemedHtml } from "@/lib/export/themed-html";
import { markdownToDocxBuffer } from "@/lib/export/md-to-docx";
import { deckToTsv } from "@/lib/export/deck-to-tsv";
import { deckToCsv } from "@/lib/export/deck-to-csv";
import { buildDeckPdfHtml } from "@/lib/export/deck-to-pdf";
import { deckToApkg } from "@/lib/export/deck-to-apkg";
import type { ExportTheme } from "@/lib/theme/types";
import { PAGE_SIZE_PDF_FORMAT } from "@/lib/theme/types";
import { MARGIN_MM } from "@/lib/theme/types";
import { FOOTER_MARKDOWN } from "@/lib/theme/constants";
import type { Deck, DeckMediaBlob } from "@/lib/flashcard/types";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";

const NOTE_FORMATS = ["pdf", "docx", "md"] as const;
const DECK_FORMATS = ["apkg", "tsv", "csv", "pdf"] as const;
type NoteExportFormat = (typeof NOTE_FORMATS)[number];
type DeckExportFormat = (typeof DECK_FORMATS)[number];

function isValidFormat(
  v: unknown,
  scope: "note" | "deck",
): v is NoteExportFormat | DeckExportFormat {
  if (typeof v !== "string") return false;
  if (scope === "deck") return DECK_FORMATS.includes(v as DeckExportFormat);
  return NOTE_FORMATS.includes(v as NoteExportFormat);
}

function invalidFormatMessage(scope: "note" | "deck"): string {
  if (scope === "deck") {
    return "Invalid or missing format. Use ?format=apkg, ?format=tsv, ?format=csv, or ?format=pdf&scope=deck";
  }
  return "Invalid or missing format. Use ?format=pdf, ?format=docx, or ?format=md";
}

function sanitizeTheme(theme: unknown): ExportTheme {
  return {
    preset: (theme as ExportTheme)?.preset ?? "modern",
    bodyFont: (theme as ExportTheme)?.bodyFont ?? "Inter",
    headingFont: (theme as ExportTheme)?.headingFont ?? "Inter",
    baseSize: (theme as ExportTheme)?.baseSize ?? "medium",
    lineSpacing: (theme as ExportTheme)?.lineSpacing ?? "1.5",
    pageSize: (theme as ExportTheme)?.pageSize ?? "us-letter",
    margins: (theme as ExportTheme)?.margins ?? "standard",
    includeToc: (theme as ExportTheme)?.includeToc ?? true,
    includeFooter: (theme as ExportTheme)?.includeFooter ?? false,
  };
}

function isDeck(value: unknown): value is Deck {
  if (!value || typeof value !== "object") return false;
  const deck = value as Deck;
  return (
    typeof deck.id === "string" &&
    typeof deck.name === "string" &&
    Array.isArray(deck.cards)
  );
}

function normalizeMedia(value: unknown): DeckMediaBlob[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is DeckMediaBlob => {
    if (!item || typeof item !== "object") return false;
    const media = item as DeckMediaBlob;
    return (
      typeof media.id === "string" &&
      typeof media.deckId === "string" &&
      typeof media.mimeType === "string" &&
      typeof media.dataBase64 === "string"
    );
  });
}

async function generatePdfFromHtml(params: {
  html: string;
  theme: ExportTheme;
}): Promise<Buffer> {
  const { html, theme } = params;

  const isDevelopment = process.env.NODE_ENV === "development";
  const headless = isDevelopment ? true : ("shell" as const);
  const executablePath = await resolveChromiumExecutablePath(isDevelopment);

  const browser = await puppeteer.launch({
    args: isDevelopment
      ? undefined
      : puppeteer.defaultArgs({ args: chromium.args, headless }),
    executablePath,
    headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await Promise.race([
      page.evaluate(() => document.fonts?.ready.then(() => true) ?? true),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
    const pdfBuffer = await page.pdf({
      format: PAGE_SIZE_PDF_FORMAT[theme.pageSize] as PaperFormat,
      printBackground: true,
      margin: {
        top: `${MARGIN_MM[theme.margins]}mm`,
        right: `${MARGIN_MM[theme.margins]}mm`,
        bottom: `${MARGIN_MM[theme.margins]}mm`,
        left: `${MARGIN_MM[theme.margins]}mm`,
      },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

async function generatePdf(params: {
  markdown: string;
  title: string;
  theme: ExportTheme;
}): Promise<Buffer> {
  const { markdown, title, theme } = params;
  const bodyHtml = await markdownToHtml(markdown);
  const html = buildThemedHtml({ title, bodyHtml, markdown, theme });
  return generatePdfFromHtml({ html, theme });
}

async function resolveChromiumExecutablePath(
  isDevelopment: boolean,
): Promise<string> {
  if (isDevelopment) {
    return (
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    );
  }

  const tracedBinPath = join(
    process.cwd(),
    "node_modules",
    "@sparticuz",
    "chromium",
    "bin",
  );

  if (existsSync(tracedBinPath)) {
    return chromium.executablePath(tracedBinPath);
  }

  return chromium.executablePath();
}

async function generateDeckPdf(deck: Deck): Promise<Buffer> {
  const html = buildDeckPdfHtml(deck);

  const isDevelopment = process.env.NODE_ENV === "development";
  const headless = isDevelopment ? true : ("shell" as const);
  const executablePath = await resolveChromiumExecutablePath(isDevelopment);

  const browser = await puppeteer.launch({
    args: isDevelopment
      ? undefined
      : puppeteer.defaultArgs({ args: chromium.args, headless }),
    executablePath,
    headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await Promise.race([
      page.evaluate(() => document.fonts?.ready.then(() => true) ?? true),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function POST(request: NextRequest) {
  const sizeCheck = checkRequestSize(request);
  if (!sizeCheck.valid) {
    return createSizeLimitResponse(sizeCheck.size!);
  }

  const rateLimit = await checkRateLimit(request, "export");
  if (!rateLimit.allowed) {
    return createRateLimitResponse(
      rateLimit.retryAfterSeconds!,
      rateLimit.reason,
    );
  }

  const { searchParams } = new URL(request.url);
  const formatParam = searchParams.get("format");
  const scopeParam = searchParams.get("scope") ?? "note";
  const scope = scopeParam === "deck" ? "deck" : "note";

  if (!isValidFormat(formatParam, scope)) {
    return NextResponse.json(
      { error: invalidFormatMessage(scope) },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ─── Deck scope ───
  if (scope === "deck") {
    const { deck, media } = body as {
      deck?: unknown;
      media?: unknown;
    };

    if (!isDeck(deck)) {
      return NextResponse.json(
        { error: "deck is required and must be a Deck object" },
        { status: 400 },
      );
    }

    const d = deck;

    try {
      if (formatParam === "tsv") {
        const tsv = deckToTsv(d);
        const encoder = new TextEncoder();
        return new NextResponse(encoder.encode(tsv), {
          status: 200,
          headers: {
            "Content-Type": "text/tab-separated-values; charset=utf-8",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(d.name)}.tsv"`,
          },
        });
      }

      if (formatParam === "csv") {
        const csv = deckToCsv(d);
        const encoder = new TextEncoder();
        return new NextResponse(encoder.encode(csv), {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(d.name)}.csv"`,
          },
        });
      }

      if (formatParam === "pdf") {
        const pdfBuffer = await generateDeckPdf(d);
        return new NextResponse(Uint8Array.from(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(d.name)}.pdf"`,
          },
        });
      }

      // format === "apkg"
      const mediaBlobs = normalizeMedia(media);
      const apkgBuffer = await deckToApkg(d, mediaBlobs);
      return new NextResponse(Buffer.from(apkgBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(d.name)}.apkg"`,
        },
      });
    } catch (err) {
      console.error("Deck export error:", err);
      return NextResponse.json(
        { error: "Deck export generation failed" },
        { status: 500 },
      );
    }
  }

  // ─── Note scope ───
  const { markdown, title, theme } = body as {
    markdown?: unknown;
    title?: unknown;
    theme?: unknown;
  };

  if (typeof markdown !== "string" || markdown.trim().length === 0) {
    return NextResponse.json(
      { error: "markdown is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  if (typeof title !== "string") {
    return NextResponse.json(
      { error: "title is required and must be a string" },
      { status: 400 },
    );
  }

  const sanitizedTheme = sanitizeTheme(theme);

  try {
    if (formatParam === "pdf") {
      try {
        const pdfBuffer = await generatePdf({
          markdown,
          title,
          theme: sanitizedTheme,
        });
        return new NextResponse(Uint8Array.from(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.pdf"`,
          },
        });
      } catch (pdfErr) {
        console.error("PDF generation failed:", pdfErr);
        return NextResponse.json(
          { error: "PDF generation failed. DOCX export is still available." },
          { status: 500 },
        );
      }
    }

    if (formatParam === "md") {
      let content = markdown;
      if (sanitizedTheme.includeFooter) {
        content = content.trimEnd() + "\n\n" + FOOTER_MARKDOWN + "\n";
      }
      const encoder = new TextEncoder();
      const bytes = encoder.encode(content);
      return new NextResponse(bytes, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.md"`,
        },
      });
    }

    // format === "docx"
    const docxBuffer = await markdownToDocxBuffer({
      markdown,
      title,
      theme: sanitizedTheme,
    });
    return new NextResponse(Uint8Array.from(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizeFilename(title)}.docx"`,
      },
    });
  } catch (err) {
    console.error("Export error:", err);
    return NextResponse.json(
      { error: "Export generation failed" },
      { status: 500 },
    );
  }
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "export";
}
