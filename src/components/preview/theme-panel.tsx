"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileText,
  Palette,
  Settings2,
  X,
  FileCode,
  List,
  Ruler,
  AlignHorizontalSpaceAround,
  Type,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExportTheme, FontChoice, BaseSize, LineSpacing, PageSize, Margins } from "@/lib/theme/types";
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

const SIZES: { key: BaseSize; label: string; short: string }[] = [
  { key: "small", label: "Small (10 pt)", short: "S" },
  { key: "medium", label: "Medium (11 pt)", short: "M" },
  { key: "large", label: "Large (12 pt)", short: "L" },
  { key: "x-large", label: "X-Large (14 pt)", short: "XL" },
];

const SPACINGS: { key: LineSpacing; label: string }[] = [
  { key: "1.15", label: "1.15" },
  { key: "1.5", label: "1.5" },
  { key: "2.0", label: "2.0" },
];

const PAGE_SIZES: { key: PageSize; label: string }[] = [
  { key: "us-letter", label: "US Letter" },
  { key: "a4", label: "A4" },
  { key: "a5", label: "A5" },
];

const MARGIN_OPTIONS: { key: Margins; label: string }[] = [
  { key: "narrow", label: "Narrow (15 mm)" },
  { key: "standard", label: "Standard (25 mm)" },
  { key: "wide", label: "Wide (35 mm)" },
];

type ThemePanelProps = {
  theme: ExportTheme;
  onChange: (theme: ExportTheme) => void;
  title: string;
  markdown: string;
};

export function ThemePanel({ theme, onChange, title, markdown }: ThemePanelProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "docx" | "md" | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const headingCount = useMemo(() => {
    let count = 0;
    for (const line of markdown.split("\n")) {
      const trimmed = line.trim();
      if (/^#{1,3}\s/.test(trimmed)) count++;
    }
    return count;
  }, [markdown]);

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

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(window.innerWidth - 32, 320);
    // Right-align to the trigger, but clamp within viewport (min 16px from edges).
    const rightEdge = Math.max(
      16,
      Math.min(window.innerWidth - rect.right, window.innerWidth - width - 16),
    );
    setPopoverStyle({
      position: "fixed",
      top: rect.bottom + 8,
      right: rightEdge,
      width,
    });
  }, [open]);

  const handleExport = useCallback(
    async (format: "pdf" | "docx" | "md") => {
      setExporting(format);
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

        const contentType = res.headers.get("Content-Type") ?? "";
        if (format === "pdf" && !contentType.includes("application/pdf")) {
          throw new Error("PDF export returned an unexpected file type.");
        }
        if (
          format === "docx" &&
          !contentType.includes(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          )
        ) {
          throw new Error("DOCX export returned an unexpected file type.");
        }
        if (format === "md" && !contentType.includes("text/markdown")) {
          throw new Error("Markdown export returned an unexpected file type.");
        }

        const blob = await res.blob();
        const elapsed = Math.round(performance.now() - t0);
        console.log(`[export] ${format.toUpperCase()} generated in ${elapsed} ms`);

        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${sanitizeFilename(title)}.${format}`;
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
    <div ref={triggerRef}>
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
          variant="outline"
          size="sm"
          onClick={() => handleExport("md")}
          disabled={exporting !== null}
          className="rounded-full text-xs font-semibold"
        >
          <FileCode className="mr-1.5 size-3.5" />
          {exporting === "md" ? "MD…" : "MD"}
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

      {/* Theme panel popover — portaled to body to escape overflow clipping */}
      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <Card style={popoverStyle} className="z-50 shadow-xl max-h-[80dvh] overflow-y-auto">
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
                <div className="flex gap-1.5">
                  {SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => update({ baseSize: s.key })}
                      title={s.label}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        theme.baseSize === s.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {s.short}
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

              {/* Page size */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <Ruler className="size-3" />
                  Page size
                </label>
                <div className="flex gap-2">
                  {PAGE_SIZES.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => update({ pageSize: s.key })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        theme.pageSize === s.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margins */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <AlignHorizontalSpaceAround className="size-3" />
                  Margins
                </label>
                <div className="flex gap-2">
                  {MARGIN_OPTIONS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => update({ margins: m.key })}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${
                        theme.margins === m.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 hover:bg-muted/50"
                      }`}
                    >
                      {m.label.split(" (")[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox
                    checked={theme.includeToc}
                    onCheckedChange={(checked) => update({ includeToc: checked === true })}
                  />
                  <span className="flex items-center gap-1">
                    <List className="size-3 text-muted-foreground" />
                    Include table of contents
                  </span>
                </label>
                {headingCount < 3 && (
                  <p className="text-[10px] text-muted-foreground pl-6">
                    TOC appears when the note has 3+ headings.
                  </p>
                )}

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <Checkbox
                    checked={theme.includeFooter}
                    onCheckedChange={(checked) => update({ includeFooter: checked === true })}
                  />
                  <span className="flex items-center gap-1">
                    <Type className="size-3 text-muted-foreground" />
                    Add &quot;Made with Powershot&quot; footer
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        </>,
        document.body,
      )}
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "export";
}
