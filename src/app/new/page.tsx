"use client";

import {
  AlertTriangle,
  ChevronRight,
  FileText,
  ImagePlus,
  Info,
  Sparkles,
  Upload,
} from "lucide-react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Filmstrip } from "@/components/upload/filmstrip";
import { UploadSurface } from "@/components/upload/upload-surface";
import { ProgressPanel } from "@/components/pipeline/progress-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createNote } from "@/lib/note/store";
import { useBatchPipeline } from "@/lib/pipeline/useBatchPipeline";
import { detectAndOrder } from "@/lib/upload/order-inference";
import type {
  OrderConfidence,
  RejectedFile,
  StagedImage,
} from "@/lib/upload/types";
import { isAcceptedImage, rejectionReason } from "@/lib/upload/validation";
import { DebugPanel, useDebugPanel } from "@/components/debug-panel";

export default function NewNotePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<StagedImage[]>([]);
  const [autoOrderIds, setAutoOrderIds] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<OrderConfidence>("high");
  const [rejections, setRejections] = useState<RejectedFile[]>([]);
  const imagesRef = useRef<StagedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const { state: pipeline, run, retryJob, reset } = useBatchPipeline();
  const debug = useDebugPanel();
  const isRunning =
    pipeline.stage === "extracting" ||
    pipeline.stage === "deduping" ||
    pipeline.stage === "reviewing";

  const handleFilesAdded = useCallback(
    async (
      accepted: File[],
      dropzoneRejections: Array<{ file: File; reason: string }>,
    ) => {
      const fresh: StagedImage[] = [];
      const newRejections: RejectedFile[] = dropzoneRejections.map((r) => ({
        name: r.file.name,
        reason: r.reason,
      }));
      for (const file of accepted) {
        if (!isAcceptedImage(file)) {
          newRejections.push({
            name: file.name,
            reason: rejectionReason(file),
          });
          continue;
        }
        const objectUrl = URL.createObjectURL(file);
        fresh.push({
          id: nanoid(),
          file,
          objectUrl,
          previewUrl: objectUrl,
          detectedAt: null,
          timestampSource: "insertion",
        });
      }

      setRejections(newRejections);
      if (fresh.length === 0) return;

      const combined = [...imagesRef.current, ...fresh];
      const { ordered, confidence } = await detectAndOrder(combined);
      setImages(ordered);
      setAutoOrderIds(ordered.map((i) => i.id));
      setConfidence(confidence);
    },
    [],
  );

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.objectUrl);
      return prev.filter((i) => i.id !== id);
    });
    setAutoOrderIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleReorder = useCallback((next: StagedImage[]) => {
    setImages(next);
  }, []);

  const handleResetOrder = useCallback(() => {
    setImages((prev) => {
      const byId = new Map(prev.map((i) => [i.id, i]));
      return autoOrderIds
        .map((id) => byId.get(id))
        .filter((x): x is StagedImage => Boolean(x));
    });
  }, [autoOrderIds]);

  const handleGenerate = useCallback(async () => {
    if (images.length === 0) return;
    reset();
    debug.clear();
    await run(images);
  }, [images, reset, run, debug]);

  useEffect(() => {
    if (pipeline.timing) {
      debug.log("Extraction", pipeline.timing.extractionMs);
      debug.log("Dedup", pipeline.timing.dedupMs);
      debug.log("Review", pipeline.timing.reviewMs);
      debug.log("Total", pipeline.timing.totalMs);
    }
  }, [pipeline.timing, debug]);

  const handleRetry = useCallback(
    (imageId: string) => {
      retryJob(imageId, images);
    },
    [images, retryJob],
  );

  const handleReviewNote = useCallback(async () => {
    if (!pipeline.result) return;
    const note = await createNote({
      title: title.trim() || "Untitled note",
      images,
      markdown: pipeline.result.markdown,
      extractedMarkdown: pipeline.result.markdown,
      anchors: pipeline.result.anchors,
      warnings: pipeline.result.warnings,
      tokenSubsetViolations: pipeline.result.tokenSubsetViolations,
    });
    router.push(`/note/${note.id}`);
  }, [pipeline.result, images, title, router]);

  const hasImages = images.length > 0;
  const isReorderedFromAuto =
    hasImages &&
    (images.length !== autoOrderIds.length ||
      images.some((img, idx) => autoOrderIds[idx] !== img.id));

  return (
    <UploadSurface onFilesAdded={handleFilesAdded}>
      {({ openFilePicker }) => (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12 sm:py-20 animate-in fade-in duration-700">
          <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="size-4 opacity-50" />
            <span className="text-foreground">New note</span>
          </nav>

          <header className="flex flex-col gap-4">
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Create a new note
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground font-medium leading-relaxed">
              Order is auto-detected from filenames and metadata. Drop, browse,
              or paste screenshots below to begin.
            </p>
          </header>

          {/* Title input */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="note-title"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Note title
            </label>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Lecture notes — April 22"
              className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-lg font-semibold text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {rejections.length > 0 && (
            <Alert
              variant="destructive"
              className="bg-destructive/5 border-destructive/20 shadow-sm animate-in slide-in-from-top-2"
            >
              <AlertTriangle className="size-4" />
              <AlertTitle className="font-semibold">
                {rejections.length}{" "}
                {rejections.length === 1 ? "file" : "files"} skipped
              </AlertTitle>
              <AlertDescription className="opacity-90">
                <ul className="mt-2 space-y-1">
                  {rejections.slice(0, 5).map((r, i) => (
                    <li key={i} className="truncate text-xs">
                      <span className="font-bold">{r.name}</span>: {r.reason}
                    </li>
                  ))}
                  {rejections.length > 5 && (
                    <li className="text-[10px] font-medium uppercase tracking-wider opacity-70">
                      + {rejections.length - 5} more files
                    </li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!hasImages ? (
            <EmptyState onPick={openFilePicker} />
          ) : (
            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {confidence === "low" && (
                <Alert className="bg-primary/5 border-primary/20 shadow-sm">
                  <Info className="size-4 text-primary" />
                  <AlertTitle className="font-semibold">
                    Order confidence is low
                  </AlertTitle>
                  <AlertDescription className="text-muted-foreground font-medium">
                    We couldn&rsquo;t perfectly detect the sequence. Please
                    verify and drag to reorder if needed.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between border-b border-border/40 pb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-base font-semibold text-foreground">
                    Staged screenshots
                    <span className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                      {images.length}
                    </span>
                  </h2>
                  {isReorderedFromAuto && (
                    <button
                      type="button"
                      onClick={handleResetOrder}
                      className="text-xs font-bold text-primary transition-colors hover:text-primary/80"
                    >
                      Reset order
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={openFilePicker}
                  className="rounded-full font-bold shadow-sm"
                >
                  <ImagePlus className="mr-2 size-4" />
                  Add more
                </Button>
              </div>

              <Filmstrip
                images={images}
                onReorder={handleReorder}
                onRemove={handleRemove}
              />
            </div>
          )}

          {/* Progress panel during pipeline */}
          {isRunning && pipeline.jobs.length > 0 && (
            <ProgressPanel
              jobs={pipeline.jobs}
              onRetry={handleRetry}
            />
          )}

          {/* Pipeline error */}
          {pipeline.stage === "failed" && pipeline.error && (
            <Alert
              variant="destructive"
              className="animate-in slide-in-from-bottom-2"
            >
              <AlertTriangle className="size-4" />
              <AlertTitle className="font-semibold">Pipeline failed</AlertTitle>
              <AlertDescription className="opacity-90">
                {pipeline.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Token-subset guardrail warning */}
          {pipeline.result?.tokenSubsetViolations &&
            pipeline.result.tokenSubsetViolations.length > 0 && (
              <Alert
                variant="destructive"
                className="animate-in slide-in-from-bottom-2"
              >
                <AlertTriangle className="size-4" />
                <AlertTitle className="font-semibold">
                  Content integrity warning
                </AlertTitle>
                <AlertDescription className="opacity-90">
                  The review pass introduced words not present in the original
                  extraction. Please verify the output before exporting.
                </AlertDescription>
              </Alert>
            )}

          {/* Ordering warnings */}
          {pipeline.result && pipeline.result.warnings.length > 0 && (
            <Alert className="bg-amber-500/5 border-amber-500/20 shadow-sm animate-in slide-in-from-bottom-2">
              <Info className="size-4 text-amber-500" />
              <AlertTitle className="font-semibold">
                Ordering warnings
              </AlertTitle>
              <AlertDescription className="text-muted-foreground font-medium">
                <ul className="mt-2 space-y-1">
                  {pipeline.result.warnings.map((w, i) => (
                    <li key={i} className="text-xs">
                      Screenshots {w.afterChunk + 1} and {w.beforeChunk + 1}{" "}
                      may be out of order: {w.reason}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Final markdown preview */}
          {pipeline.result && (
            <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Extracted Markdown
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    navigator.clipboard.writeText(pipeline.result!.markdown)
                  }
                  className="rounded-full font-semibold"
                >
                  Copy
                </Button>
              </div>
              <textarea
                readOnly
                value={pipeline.result.markdown}
                className="min-h-[300px] w-full rounded-xl border border-border/60 bg-muted/30 p-4 font-mono text-sm leading-relaxed text-foreground shadow-inner focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          )}

          <div className="sticky bottom-8 z-30 mt-auto flex items-center justify-end gap-4 rounded-2xl border border-border/40 bg-background/80 p-4 shadow-2xl backdrop-blur-xl transition-all">
            <p className="mr-auto hidden text-xs font-medium text-muted-foreground sm:block">
              {isRunning
                ? "Processing your screenshots…"
                : hasImages
                  ? pipeline.result
                    ? "Review the extracted Markdown above."
                    : "Ready to extract text from your screenshots."
                  : "Add screenshots to proceed."}
            </p>
            <Button
              asChild
              variant="ghost"
              className="rounded-full font-semibold"
            >
              <Link href="/">Cancel</Link>
            </Button>
            {pipeline.result ? (
              <Button
                type="button"
                variant="glossy"
                onClick={handleReviewNote}
                className="h-11 rounded-full px-8 text-base font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Review note
                <ChevronRight className="ml-2 size-5" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="glossy"
                disabled={!hasImages || isRunning}
                onClick={handleGenerate}
                className="h-11 rounded-full px-10 text-base font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="mr-2 size-5" />
                {isRunning ? "Processing…" : "Generate note"}
              </Button>
            )}
          </div>

          <DebugPanel entries={debug.entries} onClear={debug.clear} />
        </div>
      )}
    </UploadSurface>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur transition duration-500 group-hover:opacity-100" />
      <button
        type="button"
        onClick={onPick}
        className="relative flex h-[400px] w-full flex-col items-center justify-center gap-6 rounded-3xl border-2 border-dashed border-border/60 bg-card/40 transition-all hover:border-primary/40 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-muted shadow-inner transition-transform duration-500 group-hover:scale-110">
          <Upload className="size-10 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
        <div className="flex flex-col gap-2 px-8 text-center">
          <p className="text-xl font-bold tracking-tight text-foreground">
            Drop screenshots here to start
          </p>
          <p className="mx-auto max-w-md text-sm font-medium text-muted-foreground leading-relaxed">
            Drag files, click to browse, or paste directly from your clipboard.
            We support PNG, JPG, WebP, and HEIC.
          </p>
        </div>
        <div className="mt-2 flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3" />
            AI Extraction
          </span>
          <span className="flex items-center gap-1.5">
            <FileText className="size-3" />
            PDF &amp; DOCX
          </span>
        </div>
      </button>
    </div>
  );
}
