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
import { loadTheme } from "@/lib/theme/storage";
import { runBatchPipeline } from "@/lib/pipeline/batch";
import type { ExportTheme } from "@/lib/theme/types";
import type { Note } from "@/lib/note/types";
import { nanoid } from "nanoid";
import { isAcceptedImage } from "@/lib/upload/validation";
import type { StagedImage } from "@/lib/upload/types";


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
  const [theme, setTheme] = useState<ExportTheme>(() => loadTheme());
  const [continuing, setContinuing] = useState(false);
  const [continueError, setContinueError] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState(false);
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

      const fresh: StagedImage[] = [];
      for (const file of files) {
        if (!isAcceptedImage(file)) continue;
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

      if (fresh.length === 0) {
        setContinuing(false);
        setContinueError("No valid images selected.");
        return;
      }

      try {
        const result = await runBatchPipeline(fresh);
        const updated = await appendToNote(id, {
          markdown: result.markdown,
          extractedMarkdown: result.markdown,
          anchors: result.anchors,
          warnings: result.warnings,
          tokenSubsetViolations: result.tokenSubsetViolations,
        });
        if (updated) {
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
        // Clean up object URLs for the temporary staged images.
        for (const img of fresh) {
          URL.revokeObjectURL(img.objectUrl);
        }
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
          <h1 className="font-heading text-lg font-semibold tracking-tight truncate">
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
          accept="image/png,image/jpeg,image/webp,image/heic"
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

      {/* Split pane */}
      <div className="flex flex-col lg:flex-row flex-1 gap-4 overflow-hidden min-h-0">
        {hasImages ? (
          <ImagePane
            ref={imagePaneRef}
            images={note.images}
            warnings={note.warnings}
            activeIndex={activeIndex}
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
