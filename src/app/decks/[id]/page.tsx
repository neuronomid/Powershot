"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Brain,
  Download,
  FileText,
  ImagePlus,
  Layers,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { InstructionPromptField } from "@/components/deck/instruction-prompt-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CardEditor } from "@/components/deck/card-editor";
import {
  getDeck,
  deleteDeck,
  updateDeck,
  updateCardInDeck,
  deleteCardFromDeck,
  appendCardsToDeck,
  QuotaExceededError,
} from "@/lib/flashcard/store";
import type { Deck, Card } from "@/lib/flashcard/types";
import { isDue } from "@/lib/flashcard/sm2";
import { listDeckMedia } from "@/lib/flashcard/media";
import { useDeckPipeline } from "@/lib/pipeline/useDeckPipeline";
import type { FlashcardBatchResult } from "@/lib/pipeline/flashcard-batch";
import { detectAndOrder } from "@/lib/upload/order-inference";
import type { StagedImage } from "@/lib/upload/types";
import { isAcceptedImage, isPdfFile, MAX_IMAGES_PER_NOTE } from "@/lib/upload/validation";
import { nanoid } from "nanoid";

export default function DeckDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [quotaError, setQuotaError] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedResumeResultRef = useRef<FlashcardBatchResult | null>(null);

  const { state: pipeline, run, reset } = useDeckPipeline();
  const isResuming =
    pipeline.stage === "extracting" ||
    pipeline.stage === "deduping" ||
    pipeline.stage === "reviewing" ||
    pipeline.stage === "generating" ||
    pipeline.stage === "card-deduping";

  useEffect(() => {
    let cancelled = false;
    getDeck(id).then((d) => {
      if (cancelled) return;
      setDeck(d ?? null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const dueCount = useMemo(() => {
    if (!deck) return 0;
    return deck.cards.filter((c) => isDue(c.scheduler, now)).length;
  }, [deck, now]);

  const handleDeleteDeck = useCallback(async () => {
    if (!confirm("Delete this deck? This cannot be undone.")) return;
    await deleteDeck(id);
    router.push("/decks");
  }, [id, router]);

  const handleUpdateCard = useCallback(
    async (cardId: string, patch: Partial<Card>) => {
      const updated = await updateCardInDeck(id, cardId, patch);
      if (updated) setDeck(updated);
      setEditingCardId(null);
    },
    [id],
  );

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      if (!confirm("Delete this card?")) return;
      const updated = await deleteCardFromDeck(id, cardId);
      if (updated) setDeck(updated);
    },
    [id],
  );

  const handleExport = useCallback(
    async (format: "apkg" | "tsv" | "csv" | "pdf") => {
      if (!deck) return;
      setExporting(true);
      try {
        let body: Record<string, unknown> = { deck };
        if (format === "apkg") {
          const media = await listDeckMedia(deck.id);
          body = { deck, media };
        }
        const res = await fetch(`/api/export?format=${format}&scope=deck`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Export failed" }));
          throw new Error(data.error || "Export failed");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = format === "pdf" ? "pdf" : format;
        a.download = `${deck.name.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim() || "deck"}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setExportOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
      } finally {
        setExporting(false);
      }
    },
    [deck],
  );

  const handleFileSelect = useCallback(
    async (files: File[]) => {
      if (!deck || isResuming) return;
      setResumeError(null);
      setQuotaError(false);

      const activeDeck =
        (await updateDeck(deck.id, { preferences: deck.preferences })) ?? deck;
      if (activeDeck !== deck) {
        setDeck(activeDeck);
      }

      const fresh: StagedImage[] = [];
      let addedCount = 0;
      for (const file of files) {
        if (!isAcceptedImage(file)) continue;
        if (addedCount >= MAX_IMAGES_PER_NOTE) break;

        if (isPdfFile(file)) {
          try {
            const { renderPdfToPageImages } = await import("@/lib/upload/pdf");
            const { pages } = await renderPdfToPageImages(file);
            for (const page of pages) {
              if (addedCount >= MAX_IMAGES_PER_NOTE) break;
              const blob = await fetch(page.dataUrl).then((r) => r.blob());
              const pageFile = new File(
                [blob],
                `${file.name} page ${page.pageNumber}.jpg`,
                { type: "image/jpeg", lastModified: Date.now() },
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
            setResumeError("Failed to render PDF pages.");
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
        setResumeError("No valid images selected.");
        return;
      }

      try {
        const { ordered } = await detectAndOrder(fresh);

        reset();
        await run({
          images: ordered,
          preferences: activeDeck.preferences,
          existingCards: activeDeck.cards.map((c) => ({
            front: c.front,
            back: c.back,
          })),
          deckId: activeDeck.id,
        });
      } finally {
        for (const image of fresh) {
          URL.revokeObjectURL(image.objectUrl);
          if (image.originalObjectUrl && image.originalObjectUrl !== image.objectUrl) {
            URL.revokeObjectURL(image.originalObjectUrl);
          }
        }
      }
    },
    [deck, isResuming, reset, run],
  );

  useEffect(() => {
    if (pipeline.stage !== "completed" || !pipeline.result || !deck) return;
    if (appliedResumeResultRef.current === pipeline.result) return;
    appliedResumeResultRef.current = pipeline.result;

    appendCardsToDeck(deck.id, pipeline.result.cards)
      .then((updated) => {
        if (updated) setDeck(updated);
      })
      .catch((err) => {
        if (err instanceof QuotaExceededError) {
          setQuotaError(true);
        } else {
          setResumeError(err instanceof Error ? err.message : "Failed to append cards");
        }
      });
  }, [pipeline.stage, pipeline.result, deck]);

  if (loading) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-inner animate-pulse">
          <Layers className="size-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Loading deck…</p>
      </div>
    );
  }

  if (!deck) {
    return <ExpiredDeckState />;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 rounded-full"
          >
            <Link href="/decks">
              <ArrowLeft className="mr-1 size-4" />
              Decks
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="font-heading text-2xl font-bold tracking-tight truncate">
              {deck.name}
            </h1>
            {deck.subject && (
              <p className="text-sm font-medium text-muted-foreground">
                {deck.subject}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="glossy"
            size="sm"
            className="rounded-full font-bold shadow-md shadow-primary/15"
          >
            <Link href={`/decks/${deck.id}/review`}>
              <Play className="mr-1.5 size-4" />
              {dueCount > 0 ? `Review ${dueCount}` : "Review"}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full font-semibold"
            onClick={() => setExportOpen(true)}
          >
            <Download className="mr-1.5 size-4" />
            Export
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full font-semibold text-destructive hover:text-destructive"
            onClick={handleDeleteDeck}
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={<Layers className="size-5" />}
          label="Total cards"
          value={deck.cards.length}
        />
        <StatCard
          icon={<Brain className="size-5" />}
          label="Due today"
          value={dueCount}
          highlight={dueCount > 0}
        />
        <StatCard
          icon={<RotateCcw className="size-5" />}
          label="Sessions"
          value={deck.reviewState.sessionsCompleted}
        />
        <StatCard
          icon={<Sparkles className="size-5" />}
          label="Streak"
          value={deck.reviewState.currentStreakDays}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Resume / Add screenshots */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,application/pdf"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) handleFileSelect(files);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isResuming}
            className="rounded-full font-semibold"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImagePlus className="mr-1.5 size-4" />
            {isResuming ? "Processing…" : "Add screenshots"}
          </Button>
          {resumeError && (
            <span className="text-xs text-destructive font-medium">
              {resumeError}
            </span>
          )}
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-sm">
          <InstructionPromptField
            id="deck-generation-instructions"
            value={deck.preferences.generationInstructions}
            onChange={(generationInstructions) =>
              setDeck((current) =>
                current
                  ? {
                      ...current,
                      preferences: {
                        ...current.preferences,
                        generationInstructions,
                      },
                    }
                  : current,
              )
            }
            description='Optional. Applied the next time you generate cards in this deck. Example: "Do not make flashcards out of pronunciations from the note."'
            rows={3}
          />
        </div>
        {quotaError && (
          <div className="flex items-start gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>Storage quota exceeded. Delete some decks to free space.</span>
          </div>
        )}
      </div>

      {/* Cards list */}
      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Cards ({deck.cards.length})
        </h2>
        {deck.cards.length === 0 ? (
          <EmptyCardsState onAdd={() => fileInputRef.current?.click()} />
        ) : (
          <div className="flex flex-col gap-3">
            {deck.cards.map((card) => (
              <div
                key={card.id}
                className="rounded-2xl border border-border/60 bg-card/50 p-5 shadow-sm transition-all hover:shadow-md"
              >
                {editingCardId === card.id ? (
                  <CardEditor
                    card={card}
                    onSave={(patch) => handleUpdateCard(card.id, patch)}
                    onCancel={() => setEditingCardId(null)}
                  />
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          <span>{card.style}</span>
                          <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
                          <span>{card.difficulty}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">
                          {card.front}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full text-muted-foreground hover:text-foreground"
                          onClick={() => setEditingCardId(card.id)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                          onClick={() => handleDeleteCard(card.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="rounded-xl bg-muted/40 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Answer
                      </p>
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {card.back}
                      </p>
                      {card.extra && (
                        <p className="mt-2 text-xs text-muted-foreground whitespace-pre-wrap">
                          {card.extra}
                        </p>
                      )}
                    </div>
                    {card.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export deck</DialogTitle>
            <DialogDescription className="text-xs">
              Choose a format to export <strong>{deck.name}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <ExportButton
              label="Anki package (.apkg)"
              description="Full deck with media for Anki"
              onClick={() => handleExport("apkg")}
              loading={exporting}
            />
            <ExportButton
              label="Tab-separated (.tsv)"
              description="Plain text, Anki-importable"
              onClick={() => handleExport("tsv")}
              loading={exporting}
            />
            <ExportButton
              label="Comma-separated (.csv)"
              description="Spreadsheet-compatible"
              onClick={() => handleExport("csv")}
              loading={exporting}
            />
            <ExportButton
              label="PDF"
              description="Print-friendly front/back layout"
              onClick={() => handleExport("pdf")}
              loading={exporting}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <span
        className={`text-2xl font-bold ${
          highlight ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function ExportButton({
  label,
  description,
  onClick,
  loading,
}: {
  label: string;
  description: string;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="flex flex-col gap-0.5 rounded-xl border border-border/60 bg-background px-4 py-3 text-left transition-colors hover:bg-muted disabled:opacity-50"
    >
      <span className="text-sm font-bold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}

function EmptyCardsState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/60 bg-muted/20 py-16 text-center">
      <FileText className="size-10 text-muted-foreground" />
      <div>
        <p className="text-sm font-semibold text-muted-foreground">
          No cards yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add screenshots to generate flashcards.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="rounded-full font-semibold"
        onClick={onAdd}
      >
        <Upload className="mr-1.5 size-3.5" />
        Add screenshots
      </Button>
    </div>
  );
}

function ExpiredDeckState() {
  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-inner">
        <Layers className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Deck unavailable
        </h1>
        <p className="text-muted-foreground font-medium leading-relaxed">
          This deck was not found in your local storage. It may have been
          deleted or you may be using a different browser.
        </p>
      </div>
      <Button asChild className="rounded-full font-bold shadow-lg">
        <Link href="/decks/new">
          <Plus className="mr-2 size-4" />
          Create a new deck
        </Link>
      </Button>
    </div>
  );
}
