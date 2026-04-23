export type ThemePreset = "classic" | "modern" | "sepia" | "minimal";

export type FontChoice =
  | "Inter"
  | "IBM Plex Sans"
  | "Georgia"
  | "Merriweather"
  | "Source Serif"
  | "JetBrains Mono";

export type BaseSize = "small" | "medium" | "large" | "x-large";

export type LineSpacing = "1.15" | "1.5" | "2.0";

export type ExportTheme = {
  preset: ThemePreset;
  bodyFont: FontChoice;
  headingFont: FontChoice;
  baseSize: BaseSize;
  lineSpacing: LineSpacing;
};

export const BASE_SIZE_PT: Record<BaseSize, number> = {
  small: 10,
  medium: 11,
  large: 12,
  "x-large": 14,
};

export const LINE_SPACING_VAL: Record<LineSpacing, number> = {
  "1.15": 1.15,
  "1.5": 1.5,
  "2.0": 2.0,
};

export const FONT_CSS: Record<FontChoice, string> = {
  Inter: "'Inter', system-ui, sans-serif",
  "IBM Plex Sans": "'IBM Plex Sans', system-ui, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
  Merriweather: "'Merriweather', Georgia, serif",
  "Source Serif": "'Source Serif 4', Georgia, serif",
  "JetBrains Mono": "'JetBrains Mono', monospace",
};

export const FONT_GOOGLE_URL: Record<FontChoice, string | null> = {
  Inter: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
  "IBM Plex Sans":
    "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap",
  Georgia: null,
  Merriweather:
    "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;700&display=swap",
  "Source Serif":
    "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&display=swap",
  "JetBrains Mono":
    "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
};

export const PRESET_COLORS: Record<
  ThemePreset,
  { background: string; foreground: string; accent: string; muted: string }
> = {
  classic: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    accent: "#2c5282",
    muted: "#f7fafc",
  },
  modern: {
    background: "#ffffff",
    foreground: "#111827",
    accent: "#2563eb",
    muted: "#f9fafb",
  },
  sepia: {
    background: "#f4ecd8",
    foreground: "#3d2b1f",
    accent: "#8b6914",
    muted: "#ebe5ce",
  },
  minimal: {
    background: "#ffffff",
    foreground: "#000000",
    accent: "#000000",
    muted: "#f5f5f5",
  },
};
