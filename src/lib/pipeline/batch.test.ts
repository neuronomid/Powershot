import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StagedImage } from "@/lib/upload/types";

const resizeMocks = vi.hoisted(() => ({
  resizeImageToDataUrl: vi.fn(async (file: File) => `data:${file.name}`),
  processImageForExtraction: vi.fn(async (image: StagedImage) => `data:${image.file.name}`),
}));

vi.mock("@/lib/upload/resize", () => ({
  resizeImageToDataUrl: resizeMocks.resizeImageToDataUrl,
}));

vi.mock("@/lib/upload/process-image", () => ({
  processImageForExtraction: resizeMocks.processImageForExtraction,
}));

import { runBatchPipeline } from "./batch";

function image(id: string, fileName = `${id}.png`): StagedImage {
  return {
    id,
    file: new File(["image"], fileName, { type: "image/png" }),
    objectUrl: `blob:${id}`,
    previewUrl: `blob:${id}`,
    detectedAt: null,
    timestampSource: "insertion",
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

describe("runBatchPipeline", () => {
  beforeEach(() => {
    resizeMocks.resizeImageToDataUrl.mockClear();
    resizeMocks.processImageForExtraction.mockClear();
    vi.restoreAllMocks();
  });

  it("reports extraction callbacks and continues when some images fail", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

      if (url === "/api/extract") {
        if (body?.image === "data:two.png") {
          return jsonResponse({ error: "Vision model failed" }, { status: 500 });
        }

        return jsonResponse({
          markdown: body?.image === "data:one.png" ? "One" : "Three",
          model:
            body?.image === "data:one.png"
              ? "google/gemini-2.5-pro"
              : "google/gemini-2.5-flash",
        });
      }

      if (url === "/api/dedup") {
        return jsonResponse({ results: [] });
      }

      if (url === "/api/review") {
        expect(body).toEqual({ markdown: "One\n\nThree" });
        return jsonResponse({
          markdown: "Reviewed output",
          warnings: [{ afterChunk: 0, beforeChunk: 1, reason: "possible seam" }],
          tokenSubsetViolations: ["extra"],
        });
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const onExtractStart = vi.fn();
    const onExtractSuccess = vi.fn();
    const onExtractError = vi.fn();

    const result = await runBatchPipeline(
      [image("one"), image("two"), image("three")],
      {
        callbacks: {
          onExtractStart,
          onExtractSuccess,
          onExtractError,
        },
      },
    );

    expect(onExtractStart).toHaveBeenCalledTimes(3);
    expect(onExtractSuccess).toHaveBeenCalledTimes(2);
    expect(onExtractSuccess).toHaveBeenCalledWith(
      "one",
      "One",
      "google/gemini-2.5-pro",
    );
    expect(onExtractSuccess).toHaveBeenCalledWith(
      "three",
      "Three",
      "google/gemini-2.5-flash",
    );
    expect(onExtractError).toHaveBeenCalledExactlyOnceWith(
      "two",
      "Vision model failed",
    );
    expect(result.markdown).toBe("Reviewed output");
    expect(result.warnings).toEqual([
      { afterChunk: 0, beforeChunk: 1, reason: "possible seam" },
    ]);
    expect(result.tokenSubsetViolations).toEqual(["extra"]);
    expect(result.anchors).toEqual([
      { imageId: "one", startOffset: 0, endOffset: 3 },
      { imageId: "three", startOffset: 5, endOffset: 10 },
    ]);
  });

  it("throws when every extraction fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url !== "/api/extract") {
        throw new Error(`Unexpected fetch to ${url}`);
      }
      return jsonResponse({ error: "bad image" }, { status: 500 });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(runBatchPipeline([image("one"), image("two")])).rejects.toThrow(
      "All extractions failed. Please retry.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("applies semantic dedup spans and falls back to the combined markdown when review fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;

      if (url === "/api/extract") {
        return jsonResponse({
          markdown: body?.image === "data:one.png" ? "Chunk A" : "removeXkeep",
          model: "google/gemini-2.5-pro",
        });
      }

      if (url === "/api/dedup") {
        return jsonResponse({
          results: [
            {
              index: 0,
              deletionSpans: [{ start: 0, end: 7 }],
            },
          ],
        });
      }

      if (url === "/api/review") {
        return jsonResponse({ error: "review failed" }, { status: 500 });
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await runBatchPipeline([image("one"), image("two")]);

    expect(result.markdown).toBe("Chunk A\n\nkeep");
    expect(result.warnings).toEqual([]);
    expect(result.tokenSubsetViolations).toBeNull();
    expect(result.anchors).toEqual([
      { imageId: "one", startOffset: 0, endOffset: 7 },
      { imageId: "two", startOffset: 9, endOffset: 13 },
    ]);
  });
});
