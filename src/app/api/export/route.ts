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
import type { ExportTheme } from "@/lib/theme/types";
import { PAGE_SIZE_PDF_FORMAT } from "@/lib/theme/types";
import { MARGIN_MM } from "@/lib/theme/types";
import { FOOTER_MARKDOWN } from "@/lib/theme/constants";
import {
  checkRateLimit,
  checkRequestSize,
  createRateLimitResponse,
  createSizeLimitResponse,
} from "@/lib/rate-limit";

const ALLOWED_FORMATS = ["pdf", "docx", "md"] as const;
type ExportFormat = (typeof ALLOWED_FORMATS)[number];

function isValidFormat(v: unknown): v is ExportFormat {
  return typeof v === "string" && ALLOWED_FORMATS.includes(v as ExportFormat);
}

async function generatePdf(params: {
  markdown: string;
  title: string;
  theme: ExportTheme;
}): Promise<Buffer> {
  const { markdown, title, theme } = params;
  const bodyHtml = await markdownToHtml(markdown);
  const html = buildThemedHtml({ title, bodyHtml, markdown, theme });

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

  if (!isValidFormat(formatParam)) {
    return NextResponse.json(
      { error: "Invalid or missing format. Use ?format=pdf, ?format=docx, or ?format=md" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

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

  const sanitizedTheme: ExportTheme = {
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
