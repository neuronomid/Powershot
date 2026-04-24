"use client";

import {
  ArrowLeft,
  Layers,
  RotateCcw,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ReviewCard } from "@/components/deck/review-card";
import { ReviewSummary } from "@/components/deck/review-summary";
import { getDeck, updateDeck, updateCardInDeck } from "@/lib/flashcard/store";
import type { Deck, Card } from "@/lib/flashcard/types";
import { applyReview, isDue, type ReviewGrade } from "@/lib/flashcard/sm2";

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [lastAction, setLastAction] = useState<{
    cardId: string;
    previousScheduler: Card["scheduler"];
  } | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDeck(id).then((d) => {
      if (cancelled) return;
      if (d) {
        const now = Date.now();
        const due = d.cards.filter((c) => isDue(c.scheduler, now));
        setDeck(d);
        setQueue(shuffleArray(due));
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const currentCard = queue[currentIndex];

  const handleFlip = useCallback(() => {
    setFlipped(true);
  }, []);

  const handleGrade = useCallback(
    async (grade: ReviewGrade) => {
      if (!deck || !currentCard) return;

      const now = Date.now();
      const previousScheduler = currentCard.scheduler;
      const nextScheduler = applyReview(currentCard.scheduler, grade, now);

      setLastAction({
        cardId: currentCard.id,
        previousScheduler,
      });

      const updated = await updateCardInDeck(deck.id, currentCard.id, {
        scheduler: nextScheduler,
      });
      if (updated) setDeck(updated);

      setReviewedCount((c) => c + 1);
      if (grade === "again") setAgainCount((c) => c + 1);

      setFlipped(false);
      if (currentIndex + 1 >= queue.length) {
        // Update deck review state
        const sessionsCompleted = deck.reviewState.sessionsCompleted + 1;
        const lastReviewedAt = now;
        const currentStreakDays = computeStreak(
          deck.reviewState.lastReviewedAt,
          now,
          deck.reviewState.currentStreakDays,
        );
        await updateDeck(deck.id, {
          reviewState: {
            sessionsCompleted,
            lastReviewedAt,
            currentStreakDays,
          },
        });
        setFinished(true);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    },
    [deck, currentCard, currentIndex, queue.length],
  );

  const handleUndo = useCallback(async () => {
    if (!deck || !lastAction) return;
    const updated = await updateCardInDeck(deck.id, lastAction.cardId, {
      scheduler: lastAction.previousScheduler,
    });
    if (updated) setDeck(updated);

    setLastAction(null);
    setReviewedCount((c) => Math.max(0, c - 1));
    setCurrentIndex((i) => Math.max(0, i - 1));
    setFlipped(false);
    setFinished(false);
  }, [deck, lastAction]);

  const handleRestart = useCallback(() => {
    if (!deck) return;
    const now = Date.now();
    const due = deck.cards.filter((c) => isDue(c.scheduler, now));
    setQueue(shuffleArray(due));
    setCurrentIndex(0);
    setFlipped(false);
    setReviewedCount(0);
    setAgainCount(0);
    setLastAction(null);
    setFinished(false);
  }, [deck]);

  const progress = useMemo(() => {
    if (queue.length === 0) return 0;
    return Math.round((currentIndex / queue.length) * 100);
  }, [currentIndex, queue.length]);

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
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-inner">
          <Layers className="size-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground font-medium">Deck not found.</p>
        <Button asChild className="rounded-full font-bold shadow-lg">
          <Link href="/decks">Back to decks</Link>
        </Button>
      </div>
    );
  }

  if (finished) {
    return (
      <ReviewSummary
        deck={deck}
        reviewedCount={reviewedCount}
        againCount={againCount}
        onRestart={handleRestart}
        onBack={() => router.push(`/decks/${deck.id}`)}
      />
    );
  }

  if (queue.length === 0) {
    return (
      <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Layers className="size-8" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            All caught up
          </h1>
          <p className="text-muted-foreground font-medium">
            No cards are due for review in <strong>{deck.name}</strong>.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="rounded-full font-bold"
          >
            <Link href={`/decks/${deck.id}`}>Back to deck</Link>
          </Button>
          <Button
            variant="glossy"
            className="rounded-full font-bold"
            onClick={handleRestart}
          >
            <RotateCcw className="mr-2 size-4" />
            Review all cards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-full"
        >
          <Link href={`/decks/${deck.id}`}>
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          {lastAction && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-xs font-semibold"
              onClick={handleUndo}
            >
              <Undo2 className="mr-1.5 size-3.5" />
              Undo
            </Button>
          )}
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {currentIndex + 1} / {queue.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      {currentCard && (
        <ReviewCard
          card={currentCard}
          onGrade={handleGrade}
          flipped={flipped}
          onFlip={handleFlip}
        />
      )}
    </div>
  );
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i]!, arr[j]!] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function computeStreak(
  lastReviewedAt: number | null,
  now: number,
  currentStreak: number,
): number {
  if (!lastReviewedAt) return 1;
  const msPerDay = 86_400_000;
  const daysSince = Math.floor((now - lastReviewedAt) / msPerDay);
  if (daysSince === 0) return currentStreak;
  if (daysSince === 1) return currentStreak + 1;
  return 1;
}
