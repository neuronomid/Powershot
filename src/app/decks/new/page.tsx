"use client";

import {
  AlertTriangle,
  ChevronRight,
  ImagePlus,
  Info,
  Sparkles,
  Upload,
} from "lucide-react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { UploadSurface } from "@/components/upload/upload-surface";
import { Filmstrip } from "@/components/upload/filmstrip";
import { CropOverlay } from "@/components/upload/crop-overlay";
import { ConfigPanel } from "@/components/deck/config-panel";
import { PerScreenshotOverrideDialog } from "@/components/deck/per-screenshot-override";
import { ProgressPanel } from "@/components/pipeline/progress-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useDeckPipeline } from "@/lib/pipeline/useDeckPipeline";
import { detectAndOrder } from "@/lib/upload/order-inference";
import type {
  OrderConfidence,
  RejectedFile,
  StagedImage,
} from "@/lib/upload/types";
import { isAcceptedImage, isPdfFile, rejectionReason, MAX_IMAGES_PER_NOTE } from "@/lib/upload/validation";
import { loadEnhancePreference, saveEnhancePreference } from "@/lib/upload/enhance-storage";
import { DEFAULT_DECK_PREFERENCES } from "@/lib/flashcard/types";
import type { DeckPreferences, PerImageOverride } from "@/lib/flashcard/types";
import { createDeck, saveDeck, appendCardsToDeck } from "@/lib/flashcard/store";

export default function NewDeckPage() {
  const router = useRouter();
  const [deckName, setDeckName] = useState("");
  const [images, setImages] = useState<StagedImage[]>([]);
  const [autoOrderIds, setAutoOrderIds] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<OrderConfidence>("high");
  const [rejections, setRejections] = useState<RejectedFile[]>([]);
  const [enhance, setEnhance] = useState(() => loadEnhancePreference());
  const [preferences, setPreferences] = useState<DeckPreferences>(DEFAULT_DECK_PREFERENCES);
  const [perImageOverrides, setPerImageOverrides] = useState<PerImageOverride[]>([]);
  const [cropImageId, setCropImageId] = useState<string | null>(null);
  const [overrideImageId, setOverrideImageId] = useState<string | null>(null);
  const imagesRef = useRef<StagedImage[]>([]);
  const activeDeckIdRef = useRef<string | null>(null);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        try {
          URL.revokeObjectURL(image.objectUrl);
          if (image.originalObjectUrl && image.originalObjectUrl !== image.objectUrl) {
            URL.revokeObjectURL(image.originalObjectUrl);
          }
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  const { state: pipeline, run, reset } = useDeckPipeline();
  const isRunning =
    pipeline.stage === "extracting" ||
    pipeline.stage === "deduping" ||
    pipeline.stage === "reviewing" ||
    pipeline.stage === "generating" ||
    pipeline.stage === "card-deduping";

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

      const currentCount = imagesRef.current.length;
      const remainingSlots = Math.max(0, MAX_IMAGES_PER_NOTE - currentCount);

      if (remainingSlots === 0) {
        newRejections.push({
          name: `${accepted.length} file${accepted.length === 1 ? "" : "s"}`,
          reason: `Maximum ${MAX_IMAGES_PER_NOTE} images per deck.`,
        });
        setRejections(newRejections);
        return;
      }

      let addedCount = 0;
      for (const file of accepted) {
        if (addedCount >= remainingSlots) {
          newRejections.push({
            name: file.name,
            reason: `Maximum ${MAX_IMAGES_PER_NOTE} images per deck.`,
          });
          continue;
        }
        if (!isAcceptedImage(file)) {
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
                  reason: `Maximum ${MAX_IMAGES_PER_NOTE} images per deck.`,
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

      const combined = [...imagesRef.current, ...fresh];
      const { ordered, confidence } = await detectAndOrder(combined);
      setImages(ordered);
      setAutoOrderIds(ordered.map((i) => i.id));
      setConfidence(confidence);
    },
    [enhance],
  );

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.objectUrl);
      return prev.filter((i) => i.id !== id);
    });
    setAutoOrderIds((prev) => prev.filter((x) => x !== id));
    setPerImageOverrides((prev) => prev.filter((o) => o.imageId !== id));
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
    const deck = createDeck({
      name: deckName.trim() || "Untitled deck",
      preferences,
    });
    activeDeckIdRef.current = deck.id;
    await saveDeck(deck);

    await run({
      images,
      preferences,
      perImageOverrides,
      deckId: deck.id,
      enhance,
    });
  }, [images, reset, deckName, preferences, perImageOverrides, enhance, run]);

  // Watch for completed pipeline and redirect
  useEffect(() => {
    if (pipeline.stage !== "completed" || !pipeline.result) return;

    const deckId = activeDeckIdRef.current;
    if (!deckId) return;

    appendCardsToDeck(deckId, pipeline.result.cards).then(() => {
      router.push(`/decks/${deckId}`);
    });
  }, [pipeline.stage, pipeline.result, router]);

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

  const handleThumbnailClick = useCallback((id: string) => {
    setOverrideImageId(id);
  }, []);

  const hasImages = images.length > 0;
  const isReorderedFromAuto =
    hasImages &&
    (images.length !== autoOrderIds.length ||
      images.some((img, idx) => autoOrderIds[idx] !== img.id));

  return (
    <UploadSurface onFilesAdded={handleFilesAdded}>
      {({ openFilePicker }) => (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12 md:py-20 animate-in fade-in duration-700">
          <nav className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Link href="/decks" className="hover:text-foreground transition-colors">
              Decks
            </Link>
            <ChevronRight className="size-4 opacity-50" />
            <span className="text-foreground">New deck</span>
          </nav>

          <header className="flex flex-col gap-4">
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
              Create a new deck
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground font-medium leading-relaxed">
              Upload screenshots and let AI generate flashcards. Configure
              styles and difficulty below.
            </p>
          </header>

          {/* Deck name */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="deck-name"
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
            >
              Deck name
            </label>
            <input
              id="deck-name"
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g., Biology 101 — Cell Structure"
              className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-lg font-semibold text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ConfigPanel preferences={preferences} onChange={setPreferences} />

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
                onImageClick={handleThumbnailClick}
              />

              <p className="text-xs font-medium text-muted-foreground">
                Click a thumbnail to override flashcard settings for that
                screenshot.
              </p>
            </div>
          )}

          {/* Pipeline progress */}
          {isRunning && pipeline.jobs.length > 0 && (
            <ProgressPanel
              jobs={pipeline.jobs}
              onRetry={() => {}}
              progress={
                pipeline.genProgress
                  ? {
                      percent: Math.round(
                        (pipeline.genProgress.done / Math.max(1, pipeline.genProgress.total)) *
                          100,
                      ),
                      label: `Generating cards ${pipeline.genProgress.done} of ${pipeline.genProgress.total}…`,
                      etaSeconds: null,
                    }
                  : null
              }
              stage={pipeline.stage}
              totalImages={images.length}
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

          <div className="sticky bottom-4 sm:bottom-8 z-30 mt-auto flex items-center justify-between gap-2 sm:gap-4 rounded-2xl border border-border/40 bg-background/80 p-3 sm:p-4 shadow-2xl backdrop-blur-xl transition-all">
            <p className="mr-auto hidden text-xs font-medium text-muted-foreground sm:block">
              {isRunning
                ? "Processing your screenshots…"
                : hasImages
                  ? "Ready to generate flashcards."
                  : "Add screenshots to proceed."}
            </p>
            <Button
              asChild
              variant="ghost"
              className="rounded-full font-semibold hidden sm:inline-flex"
            >
              <Link href="/decks">Cancel</Link>
            </Button>
            <Button
              type="button"
              variant="glossy"
              disabled={!hasImages || isRunning}
              onClick={handleGenerate}
              className="h-10 sm:h-11 rounded-full px-6 sm:px-10 text-sm sm:text-base font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="mr-2 size-5" />
              {isRunning ? "Processing…" : "Generate flashcards"}
            </Button>
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

          {overrideImageId && (
            <PerScreenshotOverrideDialog
              image={images.find((i) => i.id === overrideImageId) ?? null}
              globalPreferences={preferences}
              existingOverride={perImageOverrides.find(
                (o) => o.imageId === overrideImageId,
              )}
              onClose={() => setOverrideImageId(null)}
              onSave={(override) => {
                setPerImageOverrides((prev) => {
                  const filtered = prev.filter((o) => o.imageId !== overrideImageId);
                  return override ? [...filtered, override] : filtered;
                });
              }}
            />
          )}
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
        className="relative flex h-[280px] w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-border/60 bg-card/40 transition-all hover:border-primary/40 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[400px] sm:gap-6"
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
            We support PNG, JPG, WebP, HEIC, and PDF.
          </p>
        </div>
      </button>
    </div>
  );
}
