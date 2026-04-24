"use client";

import Link from "next/link";
import { Brain, Calendar, Layers, Trash2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Deck } from "@/lib/flashcard/types";
import { isDue } from "@/lib/flashcard/sm2";

export function DeckCard({
  deck,
  onDelete,
  now,
}: {
  deck: Deck;
  onDelete: (id: string) => void;
  now: number;
}) {
  const dueCount = deck.cards.filter((c) => isDue(c.scheduler, now)).length;

  return (
    <Link href={`/decks/${deck.id}`} className="group block">
      <Card className="relative h-full overflow-hidden bg-card/50 ring-1 ring-border/50 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-primary/5">
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-heading text-base font-semibold text-foreground line-clamp-2">
              {deck.name}
            </h3>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(deck.id);
              }}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
              aria-label="Delete deck"
            >
              <Trash2 className="size-4" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Layers className="size-3.5" />
              {deck.cards.length} card{deck.cards.length !== 1 ? "s" : ""}
            </span>
            {dueCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                <Brain className="size-3.5" />
                {dueCount} due
              </span>
            )}
          </div>

          {deck.subject && (
            <p className="text-xs font-medium text-muted-foreground">
              {deck.subject}
            </p>
          )}

          <p className="text-xs font-medium text-muted-foreground">
            <Calendar className="inline mr-1 size-3" />
            {formatDate(deck.updatedAt)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
