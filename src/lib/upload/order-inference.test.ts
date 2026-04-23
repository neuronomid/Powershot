import exifr from "exifr";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { detectAndOrder } from "./order-inference";
import type { StagedImage } from "./types";

vi.mock("exifr", () => ({
  default: {
    parse: vi.fn(),
  },
}));

const parseExif = vi.mocked(exifr.parse);

function image(name: string, lastModified = 0): StagedImage {
  return {
    id: name,
    file: new File(["image"], name, { type: "image/png", lastModified }),
    objectUrl: `blob:${name}`,
    previewUrl: `blob:${name}`,
    detectedAt: null,
    timestampSource: "insertion",
  };
}

describe("detectAndOrder", () => {
  beforeEach(() => {
    parseExif.mockReset();
    parseExif.mockResolvedValue(undefined);
  });

  it("orders by filename timestamp before consulting weaker signals", async () => {
    const late = image("Screenshot 2026-04-22 at 14.33.00.png", 1000);
    const early = image("Screenshot 2026-04-22 at 14.32.00.png", 2000);

    const result = await detectAndOrder([late, early]);

    expect(result.ordered.map((img) => img.file.name)).toEqual([
      early.file.name,
      late.file.name,
    ]);
    expect(result.ordered.map((img) => img.timestampSource)).toEqual([
      "filename",
      "filename",
    ]);
    expect(result.confidence).toBe("high");
    expect(parseExif).not.toHaveBeenCalled();
  });

  it("falls back to EXIF timestamps when filenames do not carry dates", async () => {
    const earlyExif = new Date(2026, 3, 22, 14, 32, 0);
    const lateExif = new Date(2026, 3, 22, 14, 33, 0);
    parseExif.mockImplementation(async (file) => {
      return file.name === "late.png"
        ? { DateTimeOriginal: lateExif }
        : { CreateDate: earlyExif };
    });

    const result = await detectAndOrder([image("late.png", 2000), image("early.png", 1000)]);

    expect(result.ordered.map((img) => img.file.name)).toEqual(["early.png", "late.png"]);
    expect(result.ordered.map((img) => img.timestampSource)).toEqual(["exif", "exif"]);
    expect(result.ordered.map((img) => img.detectedAt?.getTime())).toEqual([
      earlyExif.getTime(),
      lateExif.getTime(),
    ]);
    expect(result.confidence).toBe("high");
  });

  it("falls back to lastModified and reports medium confidence when timestamps are spread apart", async () => {
    const result = await detectAndOrder([
      image("later-page.png", 10_000),
      image("earlier-page.png", 1_000),
    ]);

    expect(result.ordered.map((img) => img.file.name)).toEqual([
      "earlier-page.png",
      "later-page.png",
    ]);
    expect(result.ordered.map((img) => img.timestampSource)).toEqual([
      "lastModified",
      "lastModified",
    ]);
    expect(result.confidence).toBe("medium");
  });

  it("preserves insertion order for tied lastModified timestamps and reports low confidence", async () => {
    const result = await detectAndOrder([
      image("page-b.png", 10_000),
      image("page-a.png", 10_000),
    ]);

    expect(result.ordered.map((img) => img.file.name)).toEqual(["page-b.png", "page-a.png"]);
    expect(result.confidence).toBe("low");
  });

  it("reports low confidence when no timestamp source is usable", async () => {
    const result = await detectAndOrder([image("page-b.png"), image("page-a.png")]);

    expect(result.ordered.map((img) => img.file.name)).toEqual(["page-b.png", "page-a.png"]);
    expect(result.ordered.map((img) => img.timestampSource)).toEqual(["insertion", "insertion"]);
    expect(result.confidence).toBe("low");
  });

  it("continues to lastModified when EXIF parsing throws", async () => {
    parseExif.mockRejectedValue(new Error("unsupported image format"));

    const result = await detectAndOrder([
      image("later.heic", 10_000),
      image("earlier.heic", 1_000),
    ]);

    expect(result.ordered.map((img) => img.file.name)).toEqual(["earlier.heic", "later.heic"]);
    expect(result.ordered.map((img) => img.timestampSource)).toEqual([
      "lastModified",
      "lastModified",
    ]);
  });
});
