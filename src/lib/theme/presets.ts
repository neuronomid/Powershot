import type { ExportTheme, ThemePreset } from "./types";

export const defaultTheme: ExportTheme = {
  preset: "modern",
  bodyFont: "Inter",
  headingFont: "Inter",
  baseSize: "medium",
  lineSpacing: "1.5",
};

export const presetThemes: Record<ThemePreset, ExportTheme> = {
  classic: {
    preset: "classic",
    bodyFont: "Georgia",
    headingFont: "Georgia",
    baseSize: "medium",
    lineSpacing: "1.5",
  },
  modern: {
    preset: "modern",
    bodyFont: "Inter",
    headingFont: "Inter",
    baseSize: "medium",
    lineSpacing: "1.5",
  },
  sepia: {
    preset: "sepia",
    bodyFont: "Merriweather",
    headingFont: "Merriweather",
    baseSize: "medium",
    lineSpacing: "1.5",
  },
  minimal: {
    preset: "minimal",
    bodyFont: "IBM Plex Sans",
    headingFont: "IBM Plex Sans",
    baseSize: "small",
    lineSpacing: "1.15",
  },
};
