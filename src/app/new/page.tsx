"use client";

import {
  AlertTriangle,
  Brain,
  ChevronRight,
  FileText,
  ImagePlus,
  Info,
  Layers,
  Sparkles,
  Upload,
  Wand2,
  Puzzle,
  RotateCcw,
} from "lucide-react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { TermsAcceptance, useTermsAccepted } from "@/components/terms-acceptance";
import { Filmstrip } from "@/components/upload/filmstrip";
import { UploadSurface } from "@/components/upload/upload-surface";
import { CropOverlay } from "@/components/upload/crop-overlay";
import { ProgressPanel } from "@/components/pipeline/progress-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createNote } from "@/lib/note/store";
import { createDeck, appendCardsToDeck } from "@/lib/flashcard/store";
import { DEFAULT_DECK_PREFERENCES } from "@/lib/flashcard/types";
import { runFlashcardGenerationFromExtraction } from "@/lib/pipeline/flashcard-batch";
import { useBatchPipeline } from "@/lib/pipeline/useBatchPipeline";
import { detectAndOrder } from "@/lib/upload/order-inference";
import type {
  OrderConfidence,
  RejectedFile,
  StagedImage,
} from "@/lib/upload/types";
import { isAcceptedImage, isPdfFile, rejectionReason, MAX_IMAGES_PER_NOTE } from "@/lib/upload/validation";
import { loadEnhancePreference, saveEnhancePreference } from "@/lib/upload/enhance-storage";
import { DebugPanel, useDebugPanel } from "@/components/debug-panel";
import { ReviewChangeSummaryPanel } from "@/components/pipeline/review-change-summary";
import { FallbackBanner } from "@/components/pipeline/fallback-banner";
import type { ChunkMeta } from "@/lib/pipeline/types";
import { captureMessageToFiles } from "@/lib/intake/files";
import {
  isPowershotCaptureMessage,
  postPowershotCapture,
  postPowershotCaptureAck,
} from "@/lib/intake/messages";
import { loadSampleCaptureMessage } from "@/lib/sample/library";

type IntakeMode = "extension" | "sample" | null;
type ExtractionOutcome = "note" | "flashcards" | "both";

const CAPTURE_QUEUE_EVENT = "powershot:capture-queued";

type CaptureQueueWindow = Window & {
  __POWERSHOT_CAPTURE_QUEUE__?: unknown[];
};

function takeQueuedCaptureMessages(): unknown[] {
  if (typeof window === "undefined") return [];
  const queue = (window as CaptureQueueWindow).__POWERSHOT_CAPTURE_QUEUE__;
  if (!Array.isArray(queue) || queue.length === 0) return [];
  return queue.splice(0, queue.length);
}

export default function NewNotePage() {
  return (
    <Suspense fallback={<NewNotePageFallback />}>
      <NewNotePageInner />
    </Suspense>
  );
}

function NewNotePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accepted, ready: termsReady, accept: acceptTerms } = useTermsAccepted();
  const [title, setTitle] = useState("");
  const [images, setImages] = useState<StagedImage[]>([]);
  const [autoOrderIds, setAutoOrderIds] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<OrderConfidence>("high");
  const [rejections, setRejections] = useState<RejectedFile[]>([]);
  const [enhance, setEnhance] = useState(() => loadEnhancePreference());
  const [cropImageId, setCropImageId] = useState<string | null>(null);
  const [intakeMode, setIntakeMode] = useState<IntakeMode>(null);
  const [pendingAutoRun, setPendingAutoRun] = useState(false);
  const [outcomeAction, setOutcomeAction] = useState<ExtractionOutcome | null>(null);
  const [outcomeError, setOutcomeError] = useState<string | null>(null);
  const [flashcardProgress, setFlashcardProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const imagesRef = useRef<StagedImage[]>([]);
  const handledCaptureIdsRef = useRef(new Set<string>());
  const sampleRequestedRef = useRef(false);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  const { state: pipeline, progress, reviewChanges, fallbackInfo, run, retryJob, reset } = useBatchPipeline();
  const { log: debugLog, clear: debugClear, entries: debugEntries } =
    useDebugPanel();
  const isRunning =
    pipeline.stage === "extracting" ||
    pipeline.stage === "deduping" ||
    pipeline.stage === "reviewing";

  const clearStagedImages = useCallback(() => {
    setImages((prev) => {
      for (const image of prev) {
        try {
          URL.revokeObjectURL(image.objectUrl);
          if (image.originalObjectUrl && image.originalObjectUrl !== image.objectUrl) {
            URL.revokeObjectURL(image.originalObjectUrl);
          }
        } catch {
          /* ignore */
        }
      }
      return [];
    });
    setAutoOrderIds([]);
    setConfidence("high");
    setCropImageId(null);
  }, []);

  const handleFilesAdded = useCallback(
    async (
      accepted: File[],
      dropzoneRejections: Array<{ file: File; reason: string }>,
      options: { skipValidation?: boolean; suggestedTitle?: string } = {},
    ) => {
      reset();
      setOutcomeError(null);
      setOutcomeAction(null);
      setFlashcardProgress(null);

      const fresh: StagedImage[] = [];
      const newRejections: RejectedFile[] = dropzoneRejections.map((r) => ({
        name: r.file.name,
        reason: r.reason,
      }));

      const currentCount = imagesRef.current.length;
      const remainingSlots = Math.max(0, MAX_IMAGES_PER_NOTE - currentCount);

      if (remainingSlots === 0) {
        newRejections.push({
          name: `${accepted.length} file${accepted.length === 1 ? "" : "s"}`,
          reason: `Maximum ${MAX_IMAGES_PER_NOTE} images per note.`,
        });
        setRejections(newRejections);
        return;
      }

      let addedCount = 0;
      for (const file of accepted) {
        if (addedCount >= remainingSlots) {
          newRejections.push({
            name: file.name,
            reason: `Maximum ${MAX_IMAGES_PER_NOTE} images per note.`,
          });
          continue;
        }
        if (!options.skipValidation && !isAcceptedImage(file)) {
          newRejections.push({
            name: file.name,
            reason: rejectionReason(file),
          });
          continue;
        }

        if (isPdfFile(file)) {
          try {
            const { renderPdfToPageImages } = await import("@/lib/upload/pdf");
            const { pages, warning } = await renderPdfToPageImages(file);
            if (warning) {
              newRejections.push({ name: file.name, reason: warning });
            }
            for (const page of pages) {
              if (addedCount >= remainingSlots) {
                newRejections.push({
                  name: `${file.name} page ${page.pageNumber}`,
                  reason: `Maximum ${MAX_IMAGES_PER_NOTE} images per note.`,
                });
                break;
              }
              const blob = await fetch(page.dataUrl).then((r) => r.blob());
              const pageFile = new File([blob], `${file.name} page ${page.pageNumber}.jpg`, {
                type: "image/jpeg",
                lastModified: Date.now(),
              });
              const objectUrl = URL.createObjectURL(blob);
              fresh.push({
                id: nanoid(),
                file: pageFile,
                objectUrl,
                previewUrl: objectUrl,
                detectedAt: null,
                timestampSource: "insertion",
                source: "pdf-page",
                pageNumber: page.pageNumber,
                enhanced: false,
                croppedRegion: null,
              });
              addedCount++;
            }
          } catch {
            newRejections.push({
              name: file.name,
              reason: "Failed to render PDF pages. The file may be corrupted or password-protected.",
            });
          }
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
                source: "screenshot",
                enhanced: enhance,
                croppedRegion: null,
              });
        addedCount++;
      }

      setRejections(newRejections);
      if (fresh.length === 0) return;

      if (!title.trim() && options.suggestedTitle?.trim()) {
        setTitle(options.suggestedTitle.trim());
      }

      const combined = [...imagesRef.current, ...fresh];
      const { ordered, confidence } = await detectAndOrder(combined);
      setImages(ordered);
      setAutoOrderIds(ordered.map((i) => i.id));
      setConfidence(confidence);
    },
    [enhance, reset, title],
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
    debugClear();
    setOutcomeError(null);
    setOutcomeAction(null);
    setFlashcardProgress(null);
    await run(images, { enhance });
  }, [images, reset, run, debugClear, enhance]);

  useEffect(() => {
    if (pipeline.timing) {
      debugLog("Extraction", pipeline.timing.extractionMs);
      debugLog("Dedup", pipeline.timing.dedupMs);
      debugLog("Review", pipeline.timing.reviewMs);
      debugLog("Total", pipeline.timing.totalMs);
    }
    // debugLog is a stable callback; only react to new timing objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.timing]);

  const handleRetry = useCallback(
    (imageId: string) => {
      retryJob(imageId, images, { enhance });
    },
    [images, retryJob, enhance],
  );

  const buildChunkMetas = useCallback((): ChunkMeta[] => {
    return pipeline.jobs
      .filter((j) => j.model !== null)
      .map((j) => {
        const imgIndex = images.findIndex((img) => img.id === j.imageId);
        const img = images[imgIndex];
        return {
          imageIndex: imgIndex >= 0 ? imgIndex : 0,
          model: j.model!,
          imageId: j.imageId,
          croppedRegion: img?.croppedRegion ?? null,
          enhanced: img?.enhanced ?? false,
          source: img?.source ?? "screenshot",
        };
      });
  }, [pipeline.jobs, images]);

  const createNoteFromExtraction = useCallback(async () => {
    if (!pipeline.result) {
      throw new Error("Run extraction before creating a note.");
    }
    const note = await createNote({
      title: title.trim() || "Untitled note",
      images,
      markdown: pipeline.result.markdown,
      extractedMarkdown: pipeline.result.markdown,
      anchors: pipeline.result.anchors,
      warnings: pipeline.result.warnings,
      tokenSubsetViolations: pipeline.result.tokenSubsetViolations,
      chunks: buildChunkMetas(),
      transient: intakeMode === "sample",
    });
    return note;
  }, [pipeline.result, images, title, buildChunkMetas, intakeMode]);

  const createDeckFromExtraction = useCallback(async () => {
    if (!pipeline.result) {
      throw new Error("Run extraction before creating flashcards.");
    }

    const deck = createDeck({
      name: title.trim() || "Untitled deck",
      preferences: DEFAULT_DECK_PREFERENCES,
    });

    const result = await runFlashcardGenerationFromExtraction({
      images,
      markdown: pipeline.result.markdown,
      anchors: pipeline.result.anchors,
      preferences: DEFAULT_DECK_PREFERENCES,
      deckId: deck.id,
      callbacks: {
        onGenerateStart: () => {
          setFlashcardProgress({ done: 0, total: images.length });
        },
        onGenerateProgress: (done, total) => {
          setFlashcardProgress({ done, total });
        },
        onCardDedupStart: () => {
          setFlashcardProgress(null);
        },
      },
    });

    const savedDeck = await appendCardsToDeck(deck.id, result.cards);
    return savedDeck ?? deck;
  }, [pipeline.result, images, title]);

  const handleCreateOutcome = useCallback(
    async (outcome: ExtractionOutcome) => {
      if (!pipeline.result || outcomeAction) return;

      let noteWasCreated = false;
      setOutcomeAction(outcome);
      setOutcomeError(null);
      setFlashcardProgress(null);

      try {
        if (outcome === "note") {
          const note = await createNoteFromExtraction();
          router.push(`/note/${note.id}`);
          return;
        }

        if (outcome === "flashcards") {
          const deck = await createDeckFromExtraction();
          router.push(`/decks/${deck.id}`);
          return;
        }

        const note = await createNoteFromExtraction();
        noteWasCreated = Boolean(note.id);
        const deck = await createDeckFromExtraction();
        router.push(`/decks/${deck.id}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not create output.";
        setOutcomeError(
          noteWasCreated
            ? `Note created, but flashcard generation failed: ${message}`
            : message,
        );
      } finally {
        setOutcomeAction(null);
        setFlashcardProgress(null);
      }
    },
    [
      pipeline.result,
      outcomeAction,
      createNoteFromExtraction,
      createDeckFromExtraction,
      router,
    ],
  );

  const handleCrop = useCallback((id: string) => {
    setCropImageId(id);
  }, []);

  const handleApplyCrop = useCallback(
    (region: { x: number; y: number; width: number; height: number } | null) => {
      setImages((prev) =>
        prev.map((img) =>
          img.id === cropImageId ? { ...img, croppedRegion: region } : img,
        ),
      );
      setCropImageId(null);
    },
    [cropImageId],
  );

  const handleCancelCrop = useCallback(() => {
    setCropImageId(null);
  }, []);

  const handleStartFresh = useCallback(() => {
    reset();
    clearStagedImages();
    setTitle("");
    setRejections([]);
    setIntakeMode(null);
    setPendingAutoRun(false);
    setOutcomeAction(null);
    setOutcomeError(null);
    setFlashcardProgress(null);
    router.replace("/new");
  }, [clearStagedImages, reset, router]);

  const handleCaptureMessage = useCallback(
    async (message: unknown) => {
      if (!isPowershotCaptureMessage(message)) {
        return;
      }

      if (handledCaptureIdsRef.current.has(message.captureId)) {
        postPowershotCaptureAck(message.captureId, "staged");
        return;
      }

      handledCaptureIdsRef.current.add(message.captureId);

      try {
        const files = await captureMessageToFiles(message);
        await handleFilesAdded(files, [], {
          skipValidation: true,
          suggestedTitle: message.title,
        });

        setIntakeMode(message.transient ? "sample" : "extension");
        if (message.autoStart) {
          setPendingAutoRun(true);
        }

        postPowershotCaptureAck(message.captureId, "staged");
      } catch (error) {
        handledCaptureIdsRef.current.delete(message.captureId);
        setRejections((prev) => [
          ...prev,
          {
            name: message.title || "Incoming capture",
            reason:
              error instanceof Error
                ? error.message
                : "Failed to stage incoming capture.",
          },
        ]);
      }
    },
    [handleFilesAdded],
  );

  useEffect(() => {
    const drainQueuedCaptures = () => {
      for (const message of takeQueuedCaptureMessages()) {
        void handleCaptureMessage(message);
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      void handleCaptureMessage(event.data);
    };

    window.addEventListener("message", onMessage);
    window.addEventListener(CAPTURE_QUEUE_EVENT, drainQueuedCaptures);
    drainQueuedCaptures();

    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener(CAPTURE_QUEUE_EVENT, drainQueuedCaptures);
    };
  }, [handleCaptureMessage]);

  useEffect(() => {
    if (searchParams.get("sample") !== "true" || sampleRequestedRef.current) {
      return;
    }

    sampleRequestedRef.current = true;

    loadSampleCaptureMessage()
      .then((message) => {
        postPowershotCapture(message);
      })
      .catch((error) => {
        setRejections((prev) => [
          ...prev,
          {
            name: "Sample note",
            reason:
              error instanceof Error
                ? error.message
                : "Failed to load the sample note.",
          },
        ]);
      });
  }, [searchParams]);

  useEffect(() => {
    if (!accepted || !pendingAutoRun || images.length === 0 || isRunning || pipeline.result) {
      return;
    }

    setPendingAutoRun(false);
    void handleGenerate();
  }, [accepted, handleGenerate, images.length, isRunning, pendingAutoRun, pipeline.result]);

  const hasImages = images.length > 0;
  const isReorderedFromAuto =
    hasImages &&
    (images.length !== autoOrderIds.length ||
      images.some((img, idx) => autoOrderIds[idx] !== img.id));
  const waitingForExtensionCapture =
    searchParams.get("source") === "extension" &&
    intakeMode !== "extension" &&
    !hasImages &&
    !pipeline.result;

  return (
    <>
      {termsReady && !accepted && (
        <TermsAcceptance onAccept={acceptTerms} />
      )}
      <UploadSurface onFilesAdded={handleFilesAdded}>
      {({ openFilePicker }) => (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12 md:py-20 animate-in fade-in duration-700">
          <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Link href="/" className="hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <ChevronRight className="size-4 opacity-50" />
            <span className="text-foreground">New extraction</span>
          </nav>

          <header className="flex flex-col gap-4">
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Extract from screenshots
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground font-medium leading-relaxed">
              Drop, browse, or paste screenshots. Extract once, then create a
              note, flashcards, or both from the same result.
            </p>
          </header>

          {waitingForExtensionCapture && (
            <Alert className="border-primary/20 bg-primary/5 shadow-sm">
              <Puzzle className="size-4 text-primary" />
              <AlertTitle className="font-semibold">
                Waiting for your Chrome extension capture
              </AlertTitle>
              <AlertDescription className="text-muted-foreground font-medium">
                Keep this tab open for a moment. Powershot will stage the
                screenshot as soon as the extension posts it.
              </AlertDescription>
            </Alert>
          )}

          {intakeMode === "sample" && (
            <Alert className="border-primary/20 bg-primary/5 shadow-sm">
              <Sparkles className="size-4 text-primary" />
              <AlertTitle className="font-semibold">
                Sample note loaded
              </AlertTitle>
              <AlertDescription className="flex flex-col gap-3 text-muted-foreground font-medium sm:flex-row sm:items-center sm:justify-between">
                <span>
                  This demo note runs through the same intake path as the
                  extension flow. It stays transient and is cleared after this
                  session.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartFresh}
                  className="rounded-full"
                >
                  <RotateCcw className="mr-2 size-3.5" />
                  Start fresh
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {intakeMode === "extension" && hasImages && (
            <Alert className="border-primary/20 bg-primary/5 shadow-sm">
              <Puzzle className="size-4 text-primary" />
              <AlertTitle className="font-semibold">
                Capture imported from the Chrome extension
              </AlertTitle>
              <AlertDescription className="text-muted-foreground font-medium">
                Review the staged screenshot, adjust the title if needed, then
                extract once and choose a note, flashcards, or both.
              </AlertDescription>
            </Alert>
          )}

          {/* Title input */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="note-title"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Title
            </label>
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Biology lecture — April 22"
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

              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-base font-semibold text-foreground">
                    Staged screenshots
                    <span className="ml-2 rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                      {images.length}
                      {images.length >= MAX_IMAGES_PER_NOTE && (
                        <span className="ml-1 text-destructive">(max)</span>
                      )}
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
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={enhance}
                      onChange={(e) => {
                        setEnhance(e.target.checked);
                        saveEnhancePreference(e.target.checked);
                        setImages((prev) =>
                          prev.map((img) =>
                            img.source === "screenshot"
                              ? { ...img, enhanced: e.target.checked }
                              : img,
                          ),
                        );
                      }}
                      className="size-3.5 accent-primary"
                    />
                    <Wand2 className="size-3" />
                    <span className="hidden sm:inline">Enhance faint screenshots</span>
                    <span className="sm:hidden">Enhance</span>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={openFilePicker}
                    disabled={images.length >= MAX_IMAGES_PER_NOTE}
                    className="rounded-full font-bold shadow-sm"
                  >
                    <ImagePlus className="mr-2 size-4" />
                    Add more
                  </Button>
                </div>
              </div>

              <Filmstrip
                images={images}
                onReorder={handleReorder}
                onRemove={handleRemove}
                onCrop={handleCrop}
              />
            </div>
          )}

          {/* Progress panel during pipeline */}
          {isRunning && pipeline.jobs.length > 0 && (
            <ProgressPanel
              jobs={pipeline.jobs}
              onRetry={handleRetry}
              progress={progress}
              stage={pipeline.stage}
              totalImages={images.length}
            />
          )}

          {/* Extraction skeleton during pipeline */}
          {isRunning && !pipeline.result && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Extracted Markdown
                </h3>
              </div>
              <div className="min-h-[300px] w-full rounded-xl border border-border/60 bg-muted/30 p-4 shadow-inner space-y-3">
                <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
                <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
                <div className="h-4 w-full rounded bg-muted animate-pulse" />
                <div className="h-4 w-3/5 rounded bg-muted animate-pulse" />
              </div>
            </div>
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

          {/* Review-change summary */}
          {pipeline.result && reviewChanges && (
            <ReviewChangeSummaryPanel summary={reviewChanges} />
          )}

          {/* Fallback model banner */}
          {pipeline.result && fallbackInfo && (
            <FallbackBanner
              modelNames={pipeline.jobs
                .filter((j) => j.model !== null && j.model !== "google/gemini-2.5-pro")
                .map((j) => j.model!)
                .filter((v, i, a) => a.indexOf(v) === i)
              }
            />
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

          {outcomeError && (
            <Alert
              variant="destructive"
              className="animate-in slide-in-from-bottom-2"
            >
              <AlertTriangle className="size-4" />
              <AlertTitle className="font-semibold">
                Could not create output
              </AlertTitle>
              <AlertDescription className="opacity-90">
                {outcomeError}
              </AlertDescription>
            </Alert>
          )}

          {outcomeAction && (
            <Alert className="border-primary/20 bg-primary/5 shadow-sm animate-in slide-in-from-bottom-2">
              <Sparkles className="size-4 text-primary" />
              <AlertTitle className="font-semibold">
                {outcomeAction === "note"
                  ? "Creating note"
                  : outcomeAction === "flashcards"
                    ? "Creating flashcards"
                    : "Creating note and flashcards"}
              </AlertTitle>
              <AlertDescription className="text-muted-foreground font-medium">
                {flashcardProgress
                  ? `Generating cards ${flashcardProgress.done} of ${flashcardProgress.total} from the extracted text.`
                  : "Using the existing extraction without reading the screenshots again."}
              </AlertDescription>
            </Alert>
          )}

          <div className="sticky bottom-4 sm:bottom-8 z-30 mt-auto flex flex-col gap-3 rounded-2xl border border-border/40 bg-background/80 p-3 shadow-2xl backdrop-blur-xl transition-all sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-4">
            <p className="mr-auto hidden text-xs font-medium text-muted-foreground sm:block">
              {isRunning
                ? "Processing your screenshots…"
                : hasImages
                  ? pipeline.result
                    ? "Use this extraction without paying for another screenshot pass."
                    : "Ready to extract text from your screenshots."
                  : "Add screenshots to proceed."}
            </p>
            <Button
              asChild
              variant="ghost"
              className="rounded-full font-semibold hidden sm:inline-flex"
            >
              <Link href="/">Cancel</Link>
            </Button>
            {pipeline.result ? (
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(outcomeAction)}
                  onClick={() => void handleCreateOutcome("note")}
                  className="h-10 rounded-full px-4 text-sm font-bold"
                >
                  <FileText data-icon="inline-start" />
                  Create note
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={Boolean(outcomeAction)}
                  onClick={() => void handleCreateOutcome("flashcards")}
                  className="h-10 rounded-full px-4 text-sm font-bold"
                >
                  <Brain data-icon="inline-start" />
                  Create flashcards
                </Button>
                <Button
                  type="button"
                  variant="glossy"
                  disabled={Boolean(outcomeAction)}
                  onClick={() => void handleCreateOutcome("both")}
                  className="h-10 rounded-full px-4 text-sm font-bold shadow-lg shadow-primary/25"
                >
                  <Layers data-icon="inline-start" />
                  Create both
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="glossy"
                disabled={!hasImages || isRunning}
                onClick={handleGenerate}
                className="h-10 sm:h-11 rounded-full px-6 sm:px-10 text-sm sm:text-base font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="mr-2 size-5" />
                {isRunning ? "Processing…" : "Extract text"}
              </Button>
            )}
          </div>

          {cropImageId && (
            <CropOverlay
              imageUrl={
                images.find((i) => i.id === cropImageId)?.previewUrl ||
                images.find((i) => i.id === cropImageId)?.objectUrl ||
                ""
              }
              initialCrop={images.find((i) => i.id === cropImageId)?.croppedRegion}
              onApply={handleApplyCrop}
              onCancel={handleCancelCrop}
            />
          )}

          <DebugPanel entries={debugEntries} onClear={debugClear} />
        </div>
      )}
      </UploadSurface>
    </>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-primary/20 to-blue-500/20 opacity-0 blur transition duration-500 group-hover:opacity-100" />
      <button
        type="button"
        onClick={onPick}
        className="relative flex h-[280px] w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border/60 bg-card/40 transition-all hover:border-primary/40 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[400px] sm:gap-6"
      >
        <div className="relative flex size-20 items-center justify-center rounded-2xl bg-muted shadow-inner transition-transform duration-500 group-hover:scale-110">
          <Upload className="size-10 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
        <div className="flex flex-col gap-2 px-8 text-center">
          <p className="text-xl font-bold tracking-tight text-foreground">
            Drop screenshots here to extract
          </p>
          <p className="mx-auto max-w-md text-sm font-medium text-muted-foreground leading-relaxed">
            Drag files, click to browse, or paste directly from your clipboard.
            One extraction can become a note, flashcards, or both.
          </p>
        </div>
        <div className="mt-2 flex items-center gap-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <Sparkles className="size-3" />
            AI Extraction
          </span>
          <span className="flex items-center gap-1.5">
            <Brain className="size-3" />
            Flashcards
          </span>
        </div>
      </button>
    </div>
  );
}

function NewNotePageFallback() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12 md:py-20">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="space-y-3">
        <div className="h-10 w-72 rounded bg-muted" />
        <div className="h-5 w-full max-w-2xl rounded bg-muted" />
      </div>
      <div className="h-16 w-full rounded-xl bg-muted" />
      <div className="h-[320px] w-full rounded-3xl bg-muted/70" />
    </div>
  );
}
