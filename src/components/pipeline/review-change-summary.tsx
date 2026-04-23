"use client";

import { useState } from "react";
import {
  ChevronDown,
  Info,
  Scissors,
  ArrowUpDown,
  X,
} from "lucide-react";

import type { ReviewChangeSummary } from "@/lib/pipeline/types";

type ReviewChangeSummaryPanelProps = {
  summary: ReviewChangeSummary;
  onDismiss?: () => void;
};

export function ReviewChangeSummaryPanel({
  summary,
  onDismiss,
}: ReviewChangeSummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(summary.hasChanges);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  if (!summary.hasChanges) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Info className="size-4 shrink-0" />
        <span className="font-medium">
          Review made no structural changes.
        </span>
      </div>
    );
  }

  return (
    <details
      open={isExpanded}
      onToggle={(e) => setIsExpanded((e.target as HTMLDetailsElement).open)}
      className="rounded-xl border border-border/40 bg-card/60 shadow-sm"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted/30 transition-colors list-none">
        <ChevronDown
          className={`size-4 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`}
          aria-hidden="true"
        />
        <span>
          Review removed duplicates and restructured sections without rewording
          text. Here&apos;s what changed:
        </span>
        {onDismiss && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsDismissed(true);
              onDismiss();
            }}
            className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        )}
      </summary>

      <div className="border-t border-border/40 px-4 py-3 space-y-4">
        {summary.removed.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Scissors className="size-3.5" />
              Removed passages ({summary.removed.length})
            </div>
            <ul className="space-y-1.5">
              {summary.removed.map((item, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/10 px-3 py-2"
                >
                  <span className="mt-0.5 shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-destructive">
                    {item.tag}
                  </span>
                  <code className="text-xs text-foreground/80 line-clamp-3 break-all">
                    &ldquo;{item.text}&rdquo;
                  </code>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.reordered.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <ArrowUpDown className="size-3.5" />
              Reordered sections ({summary.reordered.length})
            </div>
            <ul className="space-y-1.5">
              {summary.reordered.map((item, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-foreground/80"
                >
                  <ArrowUpDown className="size-3.5 shrink-0 text-primary/50" />
                  <span>
                    <strong className="font-semibold">{item.heading}</strong>{" "}
                    was moved
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}