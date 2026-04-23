"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

type FallbackBannerProps = {
  modelNames: string[];
  onDismiss?: () => void;
};

export function FallbackBanner({ modelNames, onDismiss }: FallbackBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const uniqueNames = [...new Set(modelNames)];
  const modelText =
    uniqueNames.length === 1
      ? uniqueNames[0]
      : uniqueNames.join(", ");

  return (
    <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/20 px-4 py-3 text-sm">
      <Info className="size-4 shrink-0 mt-0.5 text-primary" />
      <span className="flex-1 text-foreground/80">
        Some sections used a fallback model ({modelText}). Consider skimming the
        affected images.
      </span>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          onDismiss?.();
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}