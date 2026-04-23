import { defaultTheme } from "./presets";
import type { ExportTheme } from "./types";

const STORAGE_KEY = "powershot:export-theme";

export function loadTheme(): ExportTheme {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultTheme;
    const parsed = JSON.parse(raw) as Partial<ExportTheme>;
    return { ...defaultTheme, ...parsed };
  } catch {
    return defaultTheme;
  }
}

export function saveTheme(theme: ExportTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // ignore quota errors
  }
}
