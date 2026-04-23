import { describe, expect, it, vi, beforeEach } from "vitest";

import { defaultTheme } from "@/lib/theme/presets";

const mocks = vi.hoisted(() => ({
  chromiumExecutablePath: vi.fn(),
  docx: vi.fn(),
  launch: vi.fn(),
  markdownToHtml: vi.fn(),
  buildThemedHtml: vi.fn(),
}));

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--no-sandbox"],
    executablePath: mocks.chromiumExecutablePath,
  },
}));

vi.mock("puppeteer-core", () => ({
  default: {
    defaultArgs: vi.fn(({ args }) => args),
    launch: mocks.launch,
  },
}));

vi.mock("@/lib/export/md-to-docx", () => ({
  markdownToDocxBuffer: mocks.docx,
}));

vi.mock("@/lib/export/markdown-to-html", () => ({
  markdownToHtml: mocks.markdownToHtml,
}));

vi.mock("@/lib/export/themed-html", () => ({
  buildThemedHtml: mocks.buildThemedHtml,
}));

import { POST } from "./route";

function exportRequest(
  format: string,
  body: Record<string, unknown> = {
    markdown: "# Test note",
    title: "Test Note",
    theme: defaultTheme,
  },
): Parameters<typeof POST>[0] {
  return new Request(`http://localhost/api/export?format=${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/export", () => {
  beforeEach(() => {
    mocks.chromiumExecutablePath.mockReset();
    mocks.docx.mockReset();
    mocks.launch.mockReset();
    mocks.markdownToHtml.mockReset();
    mocks.buildThemedHtml.mockReset();
    mocks.chromiumExecutablePath.mockResolvedValue("/tmp/chromium");
    mocks.docx.mockResolvedValue(Buffer.from("docx"));
    mocks.markdownToHtml.mockResolvedValue("<h1>Test note</h1>");
    mocks.buildThemedHtml.mockReturnValue("<html><body>Test note</body></html>");
  });

  it("rejects invalid formats", async () => {
    const response = await POST(exportRequest("txt"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid or missing format. Use ?format=pdf, ?format=docx, or ?format=md",
    });
  });

  it("rejects invalid JSON bodies", async () => {
    const request = new Request("http://localhost/api/export?format=pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid json",
    }) as unknown as Parameters<typeof POST>[0];

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid JSON body",
    });
  });

  it("validates required markdown and title fields", async () => {
    const markdownResponse = await POST(
      exportRequest("docx", {
        markdown: "   ",
        title: "Test Note",
        theme: defaultTheme,
      }),
    );

    expect(markdownResponse.status).toBe(400);
    await expect(markdownResponse.json()).resolves.toEqual({
      error: "markdown is required and must be a non-empty string",
    });

    const titleResponse = await POST(
      exportRequest("docx", {
        markdown: "# Test",
        theme: defaultTheme,
      }),
    );

    expect(titleResponse.status).toBe(400);
    await expect(titleResponse.json()).resolves.toEqual({
      error: "title is required and must be a string",
    });
  });

  it("does not return DOCX when PDF generation fails", async () => {
    mocks.launch.mockRejectedValue(new Error("Cannot launch browser"));

    const response = await POST(exportRequest("pdf"));

    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(response.headers.get("Content-Disposition")).toBeNull();
    expect(response.headers.get("X-Fallback-Format")).toBeNull();
    expect(mocks.docx).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      error: "PDF generation failed. DOCX export is still available.",
    });
  });

  it("returns a PDF on the happy path and closes the browser", async () => {
    const page = {
      setContent: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue(true),
      pdf: vi.fn().mockResolvedValue(Buffer.from("pdf")),
    };
    const browser = {
      newPage: vi.fn().mockResolvedValue(page),
      close: vi.fn().mockResolvedValue(undefined),
    };
    mocks.launch.mockResolvedValue(browser);

    const response = await POST(
      exportRequest("pdf", {
        markdown: "# Test note",
        title: 'Quarterly:/ Report?',
        theme: defaultTheme,
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Quarterly Report.pdf"',
    );
    expect(mocks.markdownToHtml).toHaveBeenCalledExactlyOnceWith("# Test note");
    expect(mocks.buildThemedHtml).toHaveBeenCalledExactlyOnceWith({
      title: "Quarterly:/ Report?",
      bodyHtml: "<h1>Test note</h1>",
      markdown: "# Test note",
      theme: defaultTheme,
    });
    expect(page.setContent).toHaveBeenCalledWith(
      "<html><body>Test note</body></html>",
      {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      },
    );
    expect(page.pdf).toHaveBeenCalledWith({
      format: "Letter",
      printBackground: true,
      margin: { top: "25mm", right: "25mm", bottom: "25mm", left: "25mm" },
    });
    expect(browser.close).toHaveBeenCalledOnce();
  });

  it("still returns DOCX for explicit DOCX exports", async () => {
    const response = await POST(exportRequest("docx"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Test Note.docx"',
    );
    expect(mocks.docx).toHaveBeenCalledOnce();
  });

  it("returns a Markdown file for md format", async () => {
    const response = await POST(exportRequest("md"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Test Note.md"',
    );
    const text = await response.text();
    expect(text).toBe("# Test note");
  });

  it("appends footer to Markdown when includeFooter is true", async () => {
    const response = await POST(
      exportRequest("md", {
        markdown: "# Test note",
        title: "Test Note",
        theme: { ...defaultTheme, includeFooter: true },
      }),
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain("# Test note");
    expect(text).toContain("Powershot");
  });

  it("sanitizes partial themes with defaults before DOCX export", async () => {
    const response = await POST(
      exportRequest("docx", {
        markdown: "# Test note",
        title: "Spec:* Draft?",
        theme: {
          preset: "sepia",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="Spec Draft.docx"',
    );
    expect(mocks.docx).toHaveBeenCalledWith({
      markdown: "# Test note",
      title: "Spec:* Draft?",
      theme: {
        ...defaultTheme,
        preset: "sepia",
      },
    });
  });

  it("returns a server error when DOCX generation fails", async () => {
    mocks.docx.mockRejectedValue(new Error("docx failed"));

    const response = await POST(exportRequest("docx"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Export generation failed",
    });
  });
});
