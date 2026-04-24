"use client";

import { Info } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type {
  DeckPreferences,
  Difficulty,
  FlashcardStyle,
  StyleCount,
} from "@/lib/flashcard/types";
import {
  ALL_FLASHCARD_STYLES,
  FLASHCARD_STYLE_DESCRIPTIONS,
  FLASHCARD_STYLE_LABELS,
} from "@/lib/flashcard/types";

type Props = {
  preferences: DeckPreferences;
  onChange: (next: DeckPreferences) => void;
  compact?: boolean;
};

const DIFFICULTIES: Difficulty[] = ["easy", "medium", "challenging"];

export function ConfigPanel({ preferences, onChange, compact }: Props) {
  const byStyle = new Map(preferences.styles.map((s) => [s.style, s.count]));

  function toggleStyle(style: FlashcardStyle) {
    const exists = byStyle.has(style);
    const next: StyleCount[] = exists
      ? preferences.styles.filter((s) => s.style !== style)
      : [...preferences.styles, { style, count: 3 }];
    onChange({ ...preferences, styles: next });
  }

  function setCount(style: FlashcardStyle, count: number) {
    const clamped = Math.max(0, Math.min(20, Math.floor(count)));
    const next = preferences.styles.map((s) =>
      s.style === style ? { ...s, count: clamped } : s,
    );
    onChange({ ...preferences, styles: next });
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm",
        compact && "p-4 gap-4",
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Flashcard styles
          </h3>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <Checkbox
              checked={preferences.styleAutoPick}
              onCheckedChange={(v) =>
                onChange({ ...preferences, styleAutoPick: v === true })
              }
            />
            Let AI skip styles that don&rsquo;t fit
          </label>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ALL_FLASHCARD_STYLES.map((style) => {
            const enabled = byStyle.has(style);
            const count = byStyle.get(style) ?? 0;
            return (
              <div
                key={style}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 p-3 transition-colors",
                  enabled && "border-primary/40 bg-primary/5",
                )}
              >
                <Checkbox
                  checked={enabled}
                  onCheckedChange={() => toggleStyle(style)}
                  className="mt-0.5"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <label className="text-sm font-bold text-foreground">
                    {FLASHCARD_STYLE_LABELS[style]}
                  </label>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {FLASHCARD_STYLE_DESCRIPTIONS[style]}
                  </p>
                </div>
                {enabled && (
                  <input
                    type="number"
                    min={0}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(style, Number(e.target.value))}
                    className="w-14 shrink-0 rounded-md border border-border/60 bg-background px-2 py-1 text-right text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Number of ${FLASHCARD_STYLE_LABELS[style]} cards`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Difficulty
        </h3>
        <div className="flex gap-2">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onChange({ ...preferences, difficulty: d })}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2 text-sm font-bold capitalize transition-colors",
                preferences.difficulty === d
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border/60 bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-[11px] leading-snug text-muted-foreground">
        <Info className="size-3.5 shrink-0 text-primary" />
        <p>
          Click a screenshot thumbnail after you add images to override these
          defaults for just that screenshot.
        </p>
      </div>
    </div>
  );
}
