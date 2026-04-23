"use client";

import {
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Scissors,
} from "lucide-react";

import type { BatchProgress } from "@/lib/pipeline/types";
import type { PipelineStage } from "@/lib/pipeline/types";

type BatchProgressBarProps = {
  progress: BatchProgress;
  stage: PipelineStage;
  totalImages: number;
};

function stageIcon(stage: PipelineStage) {
  switch (stage) {
    case "extracting":
      return <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />;
    case "deduping":
      return <Scissors className="size-4 text-primary" aria-hidden="true" />;
    case "reviewing":
      return <Eye className="size-4 text-primary" aria-hidden="true" />;
    case "completed":
      return <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />;
    default:
      return <Clock className="size-4 text-muted-foreground" aria-hidden="true" />;
  }
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s remaining`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 1) return `~1 min ${secs > 0 ? `${secs}s` : ""} remaining`;
  return `~${mins} min remaining`;
}

export function BatchProgressBar({ progress, stage, totalImages }: BatchProgressBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {stageIcon(stage)}
          <span className="text-xs font-semibold text-foreground" aria-live="polite">
            {progress.label}
          </span>
        </div>
        {progress.etaSeconds !== null && progress.etaSeconds > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            {formatEta(progress.etaSeconds)}
          </span>
        )}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Pipeline progress: ${progress.percent}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            stage === "completed"
              ? "bg-emerald-500"
              : stage === "reviewing"
                ? "bg-primary/80"
                : "bg-primary"
          }`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      {stage === "extracting" && totalImages > 1 && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/50" />
          <span>Extraction 70%</span>
          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary/30" />
          <span>Dedup 10%</span>
          <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary/20" />
          <span>Review 20%</span>
        </div>
      )}
    </div>
  );
}