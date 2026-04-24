"use client";

import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  ImagePlus,
  RotateCcw,
  Sparkles,
  Link2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { EditorPane } from "@/components/preview/editor-pane";
import { ImagePane } from "@/components/preview/image-pane";
import { ThemePanel } from "@/components/preview/theme-panel";
import { useSyncScroll } from "@/components/preview/use-sync-scroll";
import { Button } from "@/components/ui/button";
import { getNote, updateNote, deleteNote, appendToNote, QuotaExceededError } from "@/lib/note/store";
import { replaceChunkInNote } from "@/lib/note/chunk-utils";
import { loadTheme } from "@/lib/theme/storage";
import { runBatchPipeline } from "@/lib/pipeline/batch";
import type { ExportTheme } from "@/lib/theme/types";
import type { Note } from "@/lib/note/types";
import type { ChunkMeta } from "@/lib/pipeline/types";
import { nanoid } from "nanoid";
import {
  isAcceptedImage,
  isPdfFile,
  MAX_IMAGES_PER_NOTE,
} from "@/lib/upload/validation";
import type { StagedImage } from "@/lib/upload/types";
import { ReviewChangeSummaryPanel } from "@/components/pipeline/review-change-summary";
import { FallbackBanner } from "@/components/pipeline/fallback-banner";
import { computeReviewChanges } from "@/lib/pipeline/review-diff";
import { MODEL_CHAIN } from "@/lib/ai/openrouter";


export default function NotePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);
  const [markdown, setMarkdown] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [editorFocused, setEditorFocused] = useState(false);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);
  const [theme, setTheme] = useState<ExportTheme>(() => loadTheme());
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(false);
  const [continueReviewChanges, setContinueReviewChanges] = useState<
    | { summary: ReturnType<typeof computeReviewChanges>; dismissed: boolean }
    | null
  >(null);
  const [reextractingId, setReextractingId] = useState<string | null>(null);
  const imagePaneRef = useRef<HTMLDivElement>(null);
  const editorPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getNote(id).then((n) => {
      if (cancelled) return;
      if (n) {
        setNote(n);
        setMarkdown(n.markdown);
        if (n.preferences) {
          setTheme(n.preferences);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useSyncScroll({
    imagePaneRef,
    editorPaneRef,
    anchors: note?.anchors ?? [],
    enabled: syncEnabled,
    editorFocused,
    onActiveIndexChange: setActiveIndex,
  });

  const handleMarkdownChange = useCallback(
    async (value: string) => {
      setMarkdown(value);
      try {
        await updateNote(id, { markdown: value });
        setQuotaError(false);
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          setQuotaError(true);
        }
      }
    },
    [id],
  );

  const handleRevert = useCallback(async () => {
    if (!note) return;
    setMarkdown(note.extractedMarkdown);
    try {
      await updateNote(id, { markdown: note.extractedMarkdown });
      setQuotaError(false);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        setQuotaError(true);
      }
    }
  }, [note, id]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    await deleteNote(id);
    router.push("/");
  }, [id, router]);

  const handleContinue = useCallback(
    async (files: File[]) => {
      if (!note) return;
      setContinueError(null);
      setContinuing(true);
      setContinueReviewChanges(null);

      const existingCount = note.images.length;
      const remainingSlots = Math.max(0, MAX_IMAGES_PER_NOTE - existingCount);

      if (remainingSlots === 0) {
        setContinuing(false);
        setContinueError(`Maximum ${MAX_IMAGES_PER_NOTE} images per note.`);
        return;
      }

      const fresh: StagedImage[] = [];
      let addedCount = 0;
      for (const file of files) {
        if (!isAcceptedImage(file)) continue;
        if (addedCount >= remainingSlots) break;

        if (isPdfFile(file)) {
          try {
            const { renderPdfToPageImages } = await import("@/lib/upload/pdf");
            const { pages, warning } = await renderPdfToPageImages(file);
            if (warning) {
              setContinueError(warning);
            }

            for (const page of pages) {
              if (addedCount >= remainingSlots) break;
              const blob = await fetch(page.dataUrl).then((r) => r.blob());
              const pageFile = new File(
                [blob],
                `${file.name} page ${page.pageNumber}.jpg`,
                {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                },
              );
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
            setContinueError(
              "Failed to render PDF pages. The file may be corrupted or password-protected.",
            );
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
          enhanced: false,
          croppedRegion: null,
        });
        addedCount++;
      }

      if (fresh.length === 0) {
        setContinuing(false);
        setContinueError("No valid images selected.");
        return;
      }

      let appended = false;
      try {
        const extractedModels = new Map<string, string>();
        const result = await runBatchPipeline(fresh, {
          callbacks: {
            onExtractSuccess: (imageId, _markdown, model) => {
              extractedModels.set(imageId, model);
            },
          },
        });
        const preReview = result.preReviewMarkdown ?? "";
        const postReview = result.markdown;
        const changes = computeReviewChanges(preReview, postReview);
        setContinueReviewChanges({ summary: changes, dismissed: false });

        const newChunks: ChunkMeta[] = result.anchors.map((anchor) => {
          const localIndex = fresh.findIndex((img) => img.id === anchor.imageId);
          const img = fresh[localIndex];
          return {
            imageId: anchor.imageId,
            imageIndex: existingCount + Math.max(0, localIndex),
            model: extractedModels.get(anchor.imageId) ?? "",
            croppedRegion: img?.croppedRegion ?? null,
            enhanced: img?.enhanced ?? false,
            source: img?.source ?? "screenshot",
          };
        });

        const updated = await appendToNote(id, {
          markdown: result.markdown,
          extractedMarkdown: result.markdown,
          anchors: result.anchors,
          warnings: result.warnings,
          tokenSubsetViolations: result.tokenSubsetViolations,
          images: fresh,
          chunks: newChunks,
        });
        if (updated) {
          appended = true;
          setNote(updated);
          setMarkdown(updated.markdown);
          setQuotaError(false);
        }
      } catch (err) {
        if (err instanceof QuotaExceededError) {
          setQuotaError(true);
        } else {
          setContinueError(
            err instanceof Error ? err.message : "Continue failed",
          );
        }
      } finally {
        setContinuing(false);
        if (!appended) {
          for (const img of fresh) {
            URL.revokeObjectURL(img.objectUrl);
          }
        }
      }
    },
    [note, id],
  );

  const handleReextract = useCallback(
    async (imageId: string, promptType: "code" | "math") => {
      if (!note) return;
      const img = note.images.find((i) => i.id === imageId);
      if (!img) return;

      setReextractingId(imageId);
      try {
        const { processImageForExtraction } = await import("@/lib/upload/process-image");
        const dataUrl = await processImageForExtraction(img);
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, promptType }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as { markdown: string; model: string };

        const updatedNote = replaceChunkInNote(note, imageId, data.markdown);
        if (updatedNote) {
          // Update chunk model
          const imgIndex = note.images.findIndex((i) => i.id === imageId);
          const newChunks = updatedNote.chunks.map((c) =>
            c.imageId === imageId || (!c.imageId && c.imageIndex === imgIndex)
              ? { ...c, model: data.model }
              : c,
          );
          const finalNote = { ...updatedNote, chunks: newChunks };
          await updateNote(id, {
            markdown: finalNote.markdown,
            extractedMarkdown: finalNote.extractedMarkdown,
            anchors: finalNote.anchors,
            chunks: finalNote.chunks,
          });
          setNote(finalNote);
          setMarkdown(finalNote.markdown);
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "Re-extraction failed");
      } finally {
        setReextractingId(null);
      }
    },
    [note, id],
  );

  if (loading) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 sm:px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-inner animate-pulse">
          <FileText className="size-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Loading note…</p>
      </div>
    );
  }

  if (!note) {
    return <ExpiredNoteState />;
  }

  const hasImages = note.images.length > 0;
  const fallbackModels = note.chunks
    .filter((c) => c.model && c.model !== MODEL_CHAIN[0])
    .map((c) => c.model);
  const uniqueFallbackModels = [...new Set(fallbackModels)];

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] max-w-7xl flex-col gap-3 px-3 py-4 sm:gap-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full"
          >
            <Link href="/">
              <ArrowLeft className="mr-1 size-4" />
              Home
            </Link>
          </Button>
          <h1 className="font-heading text-lg font-semibold tracking-[-0.01em] truncate dark:text-[#e8edf8]">
            {note.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:flex-nowrap sm:overflow-x-auto sm:pb-0 sm:scrollbar-none">
          {/* Sync scroll toggle */}
          <label className="flex cursor-pointer items-center gap-2 rounded-full border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted/50 shrink-0">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              className="size-3.5 accent-primary"
            />
            <span className="hidden sm:inline">Sync scroll</span>
            <span className="sm:hidden">Sync</span>
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRevert}
            className="rounded-full text-xs font-semibold shrink-0"
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Revert
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard.writeText(markdown)}
            className="rounded-full text-xs font-semibold shrink-0"
          >
            <Link2 className="mr-1.5 size-3.5" />
            <span className="hidden sm:inline">Copy Markdown</span>
            <span className="sm:hidden">Copy</span>
          </Button>

          <ThemePanel
            theme={theme}
            onChange={async (t) => {
              setTheme(t);
              try {
                await updateNote(id, { preferences: t });
                setQuotaError(false);
              } catch (err) {
                if (err instanceof QuotaExceededError) {
                  setQuotaError(true);
                }
              }
            }}
            title={note.title}
            markdown={markdown}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="rounded-full text-xs font-semibold text-destructive hover:text-destructive shrink-0"
          >
            <Trash2 className="mr-1.5 size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Continue-note dropzone / file picker */}
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
          multiple
          id="continue-upload"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleContinue(files);
            e.currentTarget.value = "";
          }}
        />
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={continuing}
          className="rounded-full text-xs font-semibold"
        >
          <label htmlFor="continue-upload" className="cursor-pointer">
            <ImagePlus className="mr-1.5 size-3.5" />
            {continuing ? "Processing…" : "Add screenshots"}
          </label>
        </Button>
        {continueError && (
          <span className="text-xs text-destructive font-medium">
            {continueError}
          </span>
        )}
      </div>

      {/* Quota warning */}
      {quotaError && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Storage quota exceeded. Please delete some older notes from the home
            screen to free up space.
          </span>
        </div>
      )}

      {/* Token-subset guardrail warning */}
      {note.tokenSubsetViolations && note.tokenSubsetViolations.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Content integrity warning: the review pass introduced words not
            present in the original extraction. Please verify before exporting.
          </span>
        </div>
      )}

      {/* Fallback model banner */}
      {uniqueFallbackModels.length > 0 && !fallbackDismissed && (
        <FallbackBanner
          modelNames={uniqueFallbackModels.map((m) => {
            const map: Record<string, string> = {
              "google/gemini-2.5-pro": "Gemini 2.5 Pro",
              "google/gemini-2.5-flash": "Gemini 2.5 Flash",
              "anthropic/claude-haiku-4-5": "Claude Haiku 4.5",
            };
            return map[m] ?? m;
          })}
          onDismiss={() => setFallbackDismissed(true)}
        />
      )}

      {/* Review-change summary (for continuing) */}
      {continueReviewChanges && !continueReviewChanges.dismissed && continueReviewChanges.summary.hasChanges && (
        <ReviewChangeSummaryPanel
          summary={continueReviewChanges.summary}
          onDismiss={() => setContinueReviewChanges((prev) => prev ? { ...prev, dismissed: true } : null)}
        />
      )}

      {/* Split pane */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 overflow-hidden min-h-0">
        {hasImages ? (
          <ImagePane
            ref={imagePaneRef}
            images={note.images}
            warnings={note.warnings}
            activeIndex={activeIndex}
            chunks={note.chunks}
            onReextract={handleReextract}
            reextractingId={reextractingId}
          />
        ) : (
          <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border/60 bg-muted/20 text-center p-8">
            <FileText className="size-10 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                Source images not available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                They were not persisted across sessions. Use{" "}
                <strong>Add screenshots</strong> to append more content.
              </p>
            </div>
          </div>
        )}
        <EditorPane
          ref={editorPaneRef}
          markdown={markdown}
          onChange={handleMarkdownChange}
          onFocusChange={setEditorFocused}
          theme={theme}
        />
      </div>
    </div>
  );
}

function ExpiredNoteState() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-5rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 sm:px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-inner">
        <FileText className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Note unavailable
        </h1>
        <p className="text-muted-foreground font-medium leading-relaxed">
          This note was not found in your local storage. It may have been
          deleted or you may be using a different browser.
        </p>
      </div>
      <Button asChild className="rounded-full font-bold shadow-lg">
        <Link href="/new">
          <Sparkles className="mr-2 size-4" />
          Create a new note
        </Link>
      </Button>
    </div>
  );
}
