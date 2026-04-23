import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { defaultTheme } from "./presets";
import { loadTheme, saveTheme } from "./storage";

const STORAGE_KEY = "powershot:export-theme";

describe("theme storage", () => {
  beforeEach(() => {
    const backing = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => backing.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        backing.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        backing.delete(key);
      }),
      clear: vi.fn(() => {
        backing.clear();
      }),
      key: vi.fn((index: number) => [...backing.keys()][index] ?? null),
      get length() {
        return backing.size;
      },
    };

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: storage,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the default theme when nothing has been saved", () => {
    expect(loadTheme()).toEqual(defaultTheme);
  });

  it("merges partial saved themes with current defaults", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        preset: "sepia",
        baseSize: "large",
      }),
    );

    expect(loadTheme()).toEqual({
      ...defaultTheme,
      preset: "sepia",
      baseSize: "large",
    });
  });

  it("falls back to the default theme when storage contains invalid JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{invalid json");

    expect(loadTheme()).toEqual(defaultTheme);
  });

  it("persists the full theme payload", () => {
    const theme = {
      ...defaultTheme,
      preset: "minimal" as const,
      headingFont: "IBM Plex Sans" as const,
    };

    saveTheme(theme);

    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null"),
    ).toEqual(theme);
  });

  it("swallows storage errors when saving", () => {
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => saveTheme(defaultTheme)).not.toThrow();
  });
});
