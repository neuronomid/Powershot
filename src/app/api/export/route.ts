/**
 * Runtime: Node.js (required for puppeteer-core).
 */
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

import { markdownToHtml } from "@/lib/export/markdown-to-html";
import { buildThemedHtml } from "@/lib/export/themed-html";
import { markdownToDocxBuffer } from "@/lib/export/md-to-docx";
import type { ExportTheme } from "@/lib/theme/types";

const ALLOWED_FORMATS = ["pdf", "docx"] as const;
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
  const html = buildThemedHtml({ title, bodyHtml, theme });

  const executablePath =
    process.env.NODE_ENV === "development"
      ? process.env.PUPPETEER_EXECUTABLE_PATH ||
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : await chromium.executablePath();

  const browser = await puppeteer.launch({
    args:
      process.env.NODE_ENV === "development"
        ? undefined
        : chromium.args,
    executablePath,
    headless: true,
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
      format: "Letter",
      printBackground: true,
      margin: { top: "1in", right: "0.85in", bottom: "1in", left: "0.85in" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const formatParam = searchParams.get("format");

  if (!isValidFormat(formatParam)) {
    return NextResponse.json(
      { error: "Invalid or missing format. Use ?format=pdf or ?format=docx" },
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
