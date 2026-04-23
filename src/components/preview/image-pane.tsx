"use client";

import { forwardRef } from "react";
import { AlertTriangle, Info, Code2, Sigma } from "lucide-react";

import type { ChunkMeta, OrderingWarning } from "@/lib/pipeline/types";
import type { StagedImage } from "@/lib/upload/types";
import { Button } from "@/components/ui/button";

type ImagePaneProps = {
  images: StagedImage[];
  warnings: OrderingWarning[];
  activeIndex: number;
  chunks?: ChunkMeta[];
  onReextract?: (imageId: string, promptType: "code" | "math") => void;
  reextractingId?: string | null;
};

function getModelDisplayName(model: string): string {
  const map: Record<string, string> = {
    "google/gemini-2.5-pro": "Gemini 2.5 Pro",
    "google/gemini-2.5-flash": "Gemini 2.5 Flash",
    "anthropic/claude-haiku-4-5": "Claude Haiku 4.5",
  };
  return map[model] ?? model;
}

const PRIMARY_MODEL = "google/gemini-2.5-pro";

export const ImagePane = forwardRef<HTMLDivElement, ImagePaneProps>(
  function ImagePane({ images, warnings, activeIndex, chunks, onReextract, reextractingId }, ref) {
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
        {images.map((img, idx) => {
          const chunk = chunks?.find((c) => c.imageIndex === idx);
          const isFallback = chunk?.model && chunk.model !== PRIMARY_MODEL;

          return (
            <div key={img.id} data-image-index={idx} className="space-y-2">
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
                <div className="relative bg-muted/30 flex items-center justify-center">
                  {img.previewUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={img.previewUrl}
                        alt={img.file.name}
                        className="max-w-full h-auto object-contain"
                        loading="lazy"
                      />
                      {/* Crop highlight */}
                      {img.croppedRegion && (
                        <div
                          className="absolute border-2 border-primary/70 pointer-events-none"
                          style={{
                            left: `${img.croppedRegion.x * 100}%`,
                            top: `${img.croppedRegion.y * 100}%`,
                            width: `${img.croppedRegion.width * 100}%`,
                            height: `${img.croppedRegion.height * 100}%`,
                          }}
                        />
                      )}
                    </>
                  ) : (
                    <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
                      Preview unavailable
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-border bg-muted/20">
                  <div className="flex items-center gap-2 px-3 py-2 min-w-0">
                    <span className="truncate text-[11px] font-medium text-muted-foreground">
                      {img.file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 px-3 py-2 shrink-0">
                    {onReextract && reextractingId !== img.id && (
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 rounded-full px-2 text-[10px] font-semibold text-muted-foreground hover:text-primary"
                          onClick={() => onReextract(img.id, "code")}
                          title="Re-extract as code"
                        >
                          <Code2 className="mr-1 size-3" />
                          Code
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 rounded-full px-2 text-[10px] font-semibold text-muted-foreground hover:text-primary"
                          onClick={() => onReextract(img.id, "math")}
                          title="Re-extract as math"
                        >
                          <Sigma className="mr-1 size-3" />
                          Math
                        </Button>
                      </>
                    )}
                    {reextractingId === img.id && (
                      <span className="text-[10px] font-semibold text-muted-foreground animate-pulse">
                        Re-extracting…
                      </span>
                    )}
                    {chunk?.model && (
                      <>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          {getModelDisplayName(chunk.model)}
                        </span>
                        {isFallback && (
                          <span title="A fallback model was used for this section; you may want to skim it.">
                            <Info className="size-3 text-muted-foreground cursor-help" />
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  },
);