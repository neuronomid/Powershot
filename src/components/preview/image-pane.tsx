"use client";

import { forwardRef } from "react";
import { AlertTriangle } from "lucide-react";

import type { OrderingWarning } from "@/lib/pipeline/types";
import type { StagedImage } from "@/lib/upload/types";

type ImagePaneProps = {
  images: StagedImage[];
  warnings: OrderingWarning[];
  activeIndex: number;
};

export const ImagePane = forwardRef<HTMLDivElement, ImagePaneProps>(
  function ImagePane({ images, warnings, activeIndex }, ref) {
    // Group warnings by the first involved image index for display.
    const warningsByImage = new Map<number, OrderingWarning[]>();
    for (const w of warnings) {
      const idx = w.afterChunk;
      if (!warningsByImage.has(idx)) warningsByImage.set(idx, []);
      warningsByImage.get(idx)!.push(w);
    }

    return (
      <div
        ref={ref}
        className="flex-1 min-h-[40dvh] lg:min-h-0 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:p-4 space-y-4"
      >
        {images.map((img, idx) => (
          <div key={img.id} data-image-index={idx} className="space-y-2">
            {/* Ordering warnings for this image */}
            {warningsByImage.get(idx)?.map((w, wi) => (
              <div
                key={wi}
                className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <span>
                  Screenshots {w.afterChunk + 1} and {w.beforeChunk + 1} may be
                  out of order: {w.reason}
                </span>
              </div>
            ))}

            <div
              className={`relative rounded-lg border overflow-hidden transition-shadow ${
                activeIndex === idx
                  ? "border-primary shadow-md ring-1 ring-primary/30"
                  : "border-border shadow-sm"
              }`}
            >
              <div className="bg-muted/30 flex items-center justify-center">
                {img.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.previewUrl}
                    alt={img.file.name}
                    className="max-w-full h-auto object-contain"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                    Preview unavailable
                  </div>
                )}
              </div>
              <div className="px-3 py-2 text-[11px] font-medium text-muted-foreground truncate border-t border-border bg-muted/20">
                {img.file.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  },
);
