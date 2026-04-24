"use client";

import Image from "next/image";
import { Sparkles, Wand2 } from "lucide-react";

export function BeforeAfterDemo() {
  return (
    <div className="relative rounded-[14px] border border-border/60 bg-card/40 p-2.5 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:rounded-[18px] sm:p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-4">
        {/* Before: messy screenshot */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/50 sm:gap-2 sm:text-xs">
              <span className="inline-flex size-1.5 rounded-full bg-muted-foreground/50" />
              Screenshot in
            </div>
            <div className="flex gap-1">
              <span className="size-1.5 rounded-full bg-muted-foreground/30 sm:size-2" />
              <span className="size-1.5 rounded-full bg-muted-foreground/30 sm:size-2" />
              <span className="size-1.5 rounded-full bg-muted-foreground/30 sm:size-2" />
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-muted/40 to-muted/10">
            <Image
              src="/samples/lecture-slide.svg"
              alt="Example lecture slide screenshot"
              fill
              sizes="(min-width: 640px) 400px, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        {/* Arrow between */}
        <div className="flex items-center justify-center py-1 sm:py-0">
          <div className="inline-flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20 sm:size-14">
            <Wand2 className="size-5 rotate-90 sm:size-6 sm:rotate-0" />
          </div>
        </div>

        {/* After: structured note */}
        <div className="overflow-hidden rounded-xl border border-border/60 bg-background sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-border/50 px-3 py-2 sm:px-4 sm:py-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary sm:gap-2 sm:text-xs">
              <span className="inline-flex size-1.5 rounded-full bg-primary" />
              Structured note
            </div>
            <div className="flex gap-1 text-[9px] font-semibold tracking-wider text-muted-foreground/60 sm:gap-1.5 sm:text-[10px]">
              <span className="rounded bg-muted px-1 py-0.5 sm:px-1.5">MD</span>
              <span className="rounded bg-muted px-1 py-0.5 sm:px-1.5">PDF</span>
              <span className="rounded bg-muted px-1 py-0.5 sm:px-1.5">DOCX</span>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 overflow-hidden p-4 text-left sm:aspect-[4/3] sm:gap-2.5 sm:p-5">
            <div className="text-sm font-heading font-bold text-foreground">
              # CAP Theorem
            </div>
            <div className="text-xs text-muted-foreground">
              ## Core Trade-offs
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  <span className="font-semibold text-foreground">
                    Consistency
                  </span>
                  {" "}— every read sees the latest write
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  <span className="font-semibold text-foreground">
                    Availability
                  </span>
                  {" "}— every request returns a response
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  <span className="font-semibold text-foreground">
                    Partition tolerance
                  </span>
                  {" "}— system survives network splits
                </span>
              </li>
            </ul>
            <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-2 text-[10px] font-semibold text-muted-foreground/70 sm:mt-auto sm:gap-2">
              <Sparkles className="size-3 shrink-0 text-primary" />
              Extracted · Never paraphrased
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}