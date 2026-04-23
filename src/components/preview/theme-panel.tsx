"use client";

import { useCallback, useState } from "react";
import {
  Download,
  FileText,
  Palette,
  Settings2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExportTheme, FontChoice, BaseSize, LineSpacing } from "@/lib/theme/types";
import { presetThemes } from "@/lib/theme/presets";
import { saveTheme } from "@/lib/theme/storage";

const PRESETS: { key: ExportTheme["preset"]; label: string }[] = [
  { key: "modern", label: "Modern" },
  { key: "classic", label: "Classic" },
  { key: "sepia", label: "Sepia" },
  { key: "minimal", label: "Minimal" },
];

const FONTS: FontChoice[] = [
  "Inter",
  "IBM Plex Sans",
  "Georgia",
  "Merriweather",
  "Source Serif",
  "JetBrains Mono",
];

const SIZES: { key: BaseSize; label: string }[] = [
  { key: "small", label: "Small (10 pt)" },
  { key: "medium", label: "Medium (11 pt)" },
  { key: "large", label: "Large (12 pt)" },
  { key: "x-large", label: "X-Large (14 pt)" },
];

const SPACINGS: { key: LineSpacing; label: string }[] = [
  { key: "1.15", label: "1.15" },
  { key: "1.5", label: "1.5" },
  { key: "2.0", label: "2.0" },
];

type ThemePanelProps = {
  theme: ExportTheme;
  onChange: (theme: ExportTheme) => void;
  title: string;
  markdown: string;
};

export function ThemePanel({ theme, onChange, title, markdown }: ThemePanelProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState(false);

  const update = useCallback(
    (patch: Partial<ExportTheme>) => {
      const next = { ...theme, ...patch };
      onChange(next);
      saveTheme(next);
    },
    [theme, onChange],
  );

  const applyPreset = useCallback(
    (presetKey: ExportTheme["preset"]) => {
      const next = { ...presetThemes[presetKey] };
      onChange(next);
      saveTheme(next);
    },
    [onChange],
  );

  const handleExport = useCallback(
    async (format: "pdf" | "docx") => {
      setExporting(format);
      setFallbackWarning(false);
      const t0 = performance.now();
      try {
        const res = await fetch(`/api/export?format=${format}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown, title, theme }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Export failed" }));
          throw new Error(err.error ?? "Export failed");
        }

        const blob = await res.blob();
        const elapsed = Math.round(performance.now() - t0);
        console.log(`[export] ${format.toUpperCase()} generated in ${elapsed} ms`);

        const fallback = res.headers.get("X-Fallback-Format");
        if (fallback === "docx" && format === "pdf") {
          setFallbackWarning(true);
        }

        const extension = fallback === "docx" ? "docx" : format;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sanitizeFilename(title)}.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (err) {
        console.error("Export failed:", err);
        alert(err instanceof Error ? err.message : "Export failed");
      } finally {
        setExporting(null);
      }
    },
    [markdown, title, theme],
  );

  return (
    <div className="relative">
      {/* Export buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("pdf")}
          disabled={exporting !== null}
          className="rounded-full text-xs font-semibold"
        >
          <Download className="mr-1.5 size-3.5" />
          {exporting === "pdf" ? "PDF…" : "PDF"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleExport("docx")}
          disabled={exporting !== null}
          className="rounded-full text-xs font-semibold"
        >
          <FileText className="mr-1.5 size-3.5" />
          {exporting === "docx" ? "DOCX…" : "DOCX"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full text-xs font-semibold"
          aria-expanded={open}
        >
          <Settings2 className="mr-1.5 size-3.5" />
          Theme
        </Button>
      </div>

      {/* Fallback warning */}
      {fallbackWarning && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          PDF generation failed. A DOCX file was returned instead — open it in
          Word or LibreOffice and export to PDF.
        </div>
      )}

      {/* Theme panel popover */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <Card className="absolute right-0 top-full z-50 mt-2 w-80 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Palette className="size-4 text-muted-foreground" />
                Export theme
              </CardTitle>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setOpen(false)}
                className="rounded-full"
              >
                <X className="size-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Presets */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Preset
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => applyPreset(p.key)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                        theme.preset === p.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Body font */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Body font
                </label>
                <select
                  value={theme.bodyFont}
                  onChange={(e) => update({ bodyFont: e.target.value as FontChoice })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Heading font */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Heading font
                </label>
                <select
                  value={theme.headingFont}
                  onChange={(e) => update({ headingFont: e.target.value as FontChoice })}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-ring/50"
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Base size */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Base size
                </label>
                <div className="flex gap-2">
                  {SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => update({ baseSize: s.key })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        theme.baseSize === s.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Line spacing */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Line spacing
                </label>
                <div className="flex gap-2">
                  {SPACINGS.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => update({ lineSpacing: s.key })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        theme.lineSpacing === s.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "export";
}
