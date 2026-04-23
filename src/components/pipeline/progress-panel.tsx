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
      return <Clock className="size-4 text-muted-foreground" />;
    case "extracting":
      return <Loader2 className="size-4 animate-spin text-primary" />;
    case "reviewing":
      return <Sparkles className="size-4 animate-pulse text-amber-500" />;
    case "done":
      return <CheckCircle2 className="size-4 text-emerald-500" />;
    case "failed":
      return <AlertCircle className="size-4 text-destructive" />;
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

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/60 p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Progress
        </h3>
        <span className="text-xs font-semibold text-muted-foreground">
          {doneCount} / {total}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
          style={{
            width: `${total > 0 ? (doneCount / total) * 100 : 0}%`,
          }}
        />
      </div>

      <ul className="flex flex-col gap-2">
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
                  className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
                >
                  <RefreshCw className="size-3" />
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
