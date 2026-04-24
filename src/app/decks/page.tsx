"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Layers,
  Plus,
  Search,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DeckCard } from "@/components/deck/deck-card";
import {
  listDecks,
  deleteDeck,
  deleteOldestDeck,
  QuotaExceededError,
} from "@/lib/flashcard/store";
import type { Deck } from "@/lib/flashcard/types";
import { isDue } from "@/lib/flashcard/sm2";

export default function DecksPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    listDecks()
      .then((all) => {
        if (cancelled) return;
        setDecks(all);
        setError(null);
        setIsQuotaError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load decks from local storage.";
        setError(message);
        setIsQuotaError(err instanceof QuotaExceededError);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this deck? This cannot be undone.")) return;
      await deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
    },
    [],
  );

  const handleDeleteOldest = useCallback(async () => {
    const deletedId = await deleteOldestDeck();
    if (deletedId) {
      setDecks((prev) => prev.filter((d) => d.id !== deletedId));
      setError(null);
      setIsQuotaError(false);
    }
  }, []);

  const filteredDecks = useMemo(() => {
    if (!searchQuery.trim()) return decks;
    const q = searchQuery.toLowerCase();
    return decks.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.subject ?? "").toLowerCase().includes(q),
    );
  }, [decks, searchQuery]);

  const totalDue = useMemo(() => {
    return decks.reduce(
      (sum, d) => sum + d.cards.filter((c) => isDue(c.scheduler, now)).length,
      0,
    );
  }, [decks, now]);

  const showSearch = decks.length >= 3;
  const hasDecks = !loading && decks.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:gap-10 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Your flashcard decks
          </h1>
          <Button
            asChild
            size="sm"
            variant="glossy"
            className="h-9 rounded-full px-4 font-semibold shadow-md shadow-primary/15 ring-1 ring-primary/20"
          >
            <Link href="/decks/new">
              <Plus className="mr-1.5 size-4" />
              New deck
            </Link>
          </Button>
        </div>
        <p className="max-w-2xl text-base font-medium text-muted-foreground">
          Create study decks from your screenshots. Review with spaced
          repetition and export to Anki.
        </p>
        {totalDue > 0 && (
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary">
            <Brain className="size-3.5" />
            {totalDue} card{totalDue !== 1 ? "s" : ""} due for review
          </div>
        )}
      </header>

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            {error}
          </div>
          {isQuotaError && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteOldest}
              className="rounded-full text-xs font-semibold border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Delete oldest deck
            </Button>
          )}
        </div>
      )}

      {showSearch && (
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decks…"
            className="w-full rounded-xl border border-border/60 bg-background pl-9 pr-9 py-2.5 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-32 animate-pulse bg-muted/50" />
          ))}
        </div>
      ) : hasDecks ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDecks.length === 0 && searchQuery ? (
            <Card className="lg:col-span-3">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <Layers className="size-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      No decks match your search
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try a different keyword or clear your search.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery("")}
                    className="rounded-full"
                  >
                    Clear search
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredDecks.map((deck) => (
              <DeckCard
                key={deck.id}
                deck={deck}
                onDelete={handleDelete}
                now={now}
              />
            ))
          )}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="bg-card/50">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <Layers className="size-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            No decks yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create your first deck to start generating flashcards from
            screenshots.
          </p>
        </div>
        <Button asChild variant="glossy" className="rounded-full font-bold">
          <Link href="/decks/new">
            <Plus className="mr-2 size-4" />
            Create a deck
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
