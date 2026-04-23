import { describe, expect, it } from "vitest";

import { parseFilenameTimestamp } from "./filename-timestamp";

function parts(date: Date | null) {
  expect(date).not.toBeNull();
  return {
    year: date?.getFullYear(),
    month: date ? date.getMonth() + 1 : undefined,
    day: date?.getDate(),
    hour: date?.getHours(),
    minute: date?.getMinutes(),
    second: date?.getSeconds(),
  };
}

describe("parseFilenameTimestamp", () => {
  it.each([
    [
      "macOS 24-hour Screenshot",
      "Screenshot 2026-04-22 at 14.32.05.png",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
    [
      "macOS AM/PM Screen Shot",
      "Screen Shot 2026-04-22 at 2.32.05 PM.png",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
    [
      "macOS midnight",
      "Screen Shot 2026-04-22 at 12.01.02 AM.png",
      { year: 2026, month: 4, day: 22, hour: 0, minute: 1, second: 2 },
    ],
    [
      "Android compact",
      "Screenshot_20260422_143205.png",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
    [
      "Android dashed",
      "Screenshot_2026-04-22-14-32-05.png",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
    [
      "iOS IMG",
      "IMG_20260422_143205.jpg",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
    [
      "Windows",
      "Screenshot 2026-04-22 143205.png",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
    [
      "generic ISO-like",
      "capture-2026-04-22T14:32:05.webp",
      { year: 2026, month: 4, day: 22, hour: 14, minute: 32, second: 5 },
    ],
  ])("parses %s filenames", (_label, filename, expected) => {
    expect(parts(parseFilenameTimestamp(filename))).toEqual(expected);
  });

  it("returns null for filenames without supported timestamp patterns", () => {
    expect(parseFilenameTimestamp("lecture-slide-final.png")).toBeNull();
  });

  it("rejects impossible date parts instead of allowing Date rollover", () => {
    expect(parseFilenameTimestamp("Screenshot 2026-13-40 at 14.32.05.png")).toBeNull();
  });
});
