import { describe, expect, it, vi, beforeEach } from "vitest";

import { defaultTheme } from "@/lib/theme/presets";

const mocks = vi.hoisted(() => ({
  chromiumExecutablePath: vi.fn(),
  docx: vi.fn(),
  launch: vi.fn(),
}));

vi.mock("@sparticuz/chromium", () => ({
  default: {
    args: ["--no-sandbox"],
    executablePath: mocks.chromiumExecutablePath,
  },
}));

vi.mock("puppeteer-core", () => ({
  default: {
    launch: mocks.launch,
  },
}));

vi.mock("@/lib/export/md-to-docx", () => ({
  markdownToDocxBuffer: mocks.docx,
}));

import { POST } from "./route";

function exportRequest(format: string): Parameters<typeof POST>[0] {
  return new Request(`http://localhost/api/export?format=${format}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: "# Test note",
      title: "Test Note",
      theme: defaultTheme,
    }),
  }) as unknown as Parameters<typeof POST>[0];
}

describe("POST /api/export", () => {
  beforeEach(() => {
    mocks.chromiumExecutablePath.mockResolvedValue("/tmp/chromium");
    mocks.docx.mockResolvedValue(Buffer.from("docx"));
    mocks.launch.mockReset();
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
});
