"use client";

import { Brain, CheckCircle2, RotateCcw, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Deck } from "@/lib/flashcard/types";

export function ReviewSummary({
  deck,
  reviewedCount,
  againCount,
  onRestart,
  onBack,
}: {
  deck: Deck;
  reviewedCount: number;
  againCount: number;
  onRestart: () => void;
  onBack: () => void;
}) {
  const accuracy =
    reviewedCount > 0
      ? Math.round(((reviewedCount - againCount) / reviewedCount) * 100)
      : 0;

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-12 text-center">
      <div className="flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <Trophy className="size-10" />
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Session complete
        </h2>
        <p className="text-sm font-medium text-muted-foreground">
          You reviewed {reviewedCount} card{reviewedCount !== 1 ? "s" : ""} from{" "}
          <span className="text-foreground">{deck.name}</span>.
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/50 p-4">
          <CheckCircle2 className="mx-auto size-6 text-emerald-500" />
          <span className="text-2xl font-bold text-foreground">{accuracy}%</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Accuracy
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/50 p-4">
          <Brain className="mx-auto size-6 text-primary" />
          <span className="text-2xl font-bold text-foreground">
            {reviewedCount}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cards reviewed
          </span>
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-11 flex-1 rounded-full font-bold"
          onClick={onBack}
        >
          Back to deck
        </Button>
        <Button
          type="button"
          variant="glossy"
          className="h-11 flex-1 rounded-full font-bold"
          onClick={onRestart}
        >
          <RotateCcw className="mr-2 size-4" />
          Review again
        </Button>
      </div>
    </div>
  );
}
