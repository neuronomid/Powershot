import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import type { BatchProgress, ExtractionJob, PipelineStage } from "@/lib/pipeline/types";
import { MODEL_CHAIN } from "@/lib/ai/openrouter";
import { BatchProgressBar } from "./batch-progress";

const PRIMARY_MODEL = MODEL_CHAIN[0];

function getModelDisplayName(model: string | null): string {
  if (!model) return "";
  const map: Record<string, string> = {
    "google/gemini-2.5-pro": "Gemini 2.5 Pro",
    "google/gemini-2.5-flash": "Gemini 2.5 Flash",
    "anthropic/claude-haiku-4-5": "Claude Haiku 4.5",
  };
  return map[model] ?? model;
}

function statusIcon(status: ExtractionJob["status"]) {
  switch (status) {
    case "queued":
      return <Clock className="size-4 text-muted-foreground" aria-hidden="true" />;
    case "extracting":
      return <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />;
    case "reviewing":
      return <Sparkles className="size-4 animate-pulse text-amber-500" aria-hidden="true" />;
    case "done":
      return (
        <CheckCircle2
          className="size-4 text-emerald-500 animate-in zoom-in duration-300"
          aria-hidden="true"
        />
      );
    case "failed":
      return <AlertCircle className="size-4 text-destructive" aria-hidden="true" />;
    default:
      return null;
  }
}

function statusLabel(status: ExtractionJob["status"]): string {
  switch (status) {
    case "queued":
      return "Queued";
    case "extracting":
      return "Extracting";
    case "reviewing":
      return "Reviewing";
    case "done":
      return "Done";
    case "failed":
      return "Failed";
    default:
      return "";
  }
}

type ProgressPanelProps = {
  jobs: ExtractionJob[];
  onRetry: (imageId: string) => void;
  progress: BatchProgress | null;
  stage: PipelineStage;
  totalImages: number;
};

export function ProgressPanel({ jobs, onRetry, progress, stage, totalImages }: ProgressPanelProps) {
  const isSingleImage = totalImages <= 1;

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/60 p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2"
      role="region"
      aria-label="Extraction progress"
    >
      {/* Batch progress bar (hidden for single image) */}
      {progress && !isSingleImage && (
        <BatchProgressBar progress={progress} stage={stage} totalImages={totalImages} />
      )}

      {/* Per-image progress */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Per-image status
        </h3>
        <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
          {jobs.filter((j) => j.status === "done").length} / {jobs.length}
        </span>
      </div>

      <ul className="flex flex-col gap-2" role="list" aria-label="Per-image extraction status">
        {jobs.map((job) => (
          <li
            key={job.imageId}
            className="flex items-center justify-between rounded-lg bg-background/60 px-3 py-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              {statusIcon(job.status)}
              <span className="truncate text-xs font-medium text-foreground">
                {job.fileName}
              </span>
              {job.status === "done" && job.model && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {getModelDisplayName(job.model)}
                </span>
              )}
{job.status === "done" && job.model !== null && job.model !== PRIMARY_MODEL && (
                <span title="A fallback model was used for this section; you may want to skim it.">
                  <Info className="size-3 text-muted-foreground cursor-help" />
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {statusLabel(job.status)}
              </span>
              {job.status === "failed" && (
                <button
                  type="button"
                  onClick={() => onRetry(job.imageId)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RefreshCw className="size-3" aria-hidden="true" />
                  Retry
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}