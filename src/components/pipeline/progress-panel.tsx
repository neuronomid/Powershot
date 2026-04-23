import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import type { ExtractionJob } from "@/lib/pipeline/types";

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

function statusLabel(status: ExtractionJob["status"]) {
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
};

export function ProgressPanel({ jobs, onRetry }: ProgressPanelProps) {
  const doneCount = jobs.filter((j) => j.status === "done").length;
  const total = jobs.length;
  const percent = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/60 p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2"
      role="region"
      aria-label="Extraction progress"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Progress
        </h3>
        <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
          {doneCount} / {total}
        </span>
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall extraction progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{
            width: `${percent}%`,
          }}
        />
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
