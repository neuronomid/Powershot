"use client";

import { useState } from "react";
import { Save, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Card } from "@/lib/flashcard/types";

export function CardEditor({
  card,
  onSave,
  onCancel,
}: {
  card: Card;
  onSave: (patch: Partial<Card>) => void;
  onCancel: () => void;
}) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [extra, setExtra] = useState(card.extra ?? "");
  const [tags, setTags] = useState(card.tags.join(", "));

  function handleSave() {
    onSave({
      front: front.trim(),
      back: back.trim(),
      extra: extra.trim() || undefined,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Front
        </label>
        <textarea
          value={front}
          onChange={(e) => setFront(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Back
        </label>
        <textarea
          value={back}
          onChange={(e) => setBack(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Extra
        </label>
        <textarea
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          rows={2}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tags (comma-separated)
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="rounded-full"
        >
          <X className="mr-1.5 size-3.5" />
          Cancel
        </Button>
        <Button
          type="button"
          variant="glossy"
          size="sm"
          onClick={handleSave}
          className="rounded-full"
        >
          <Save className="mr-1.5 size-3.5" />
          Save
        </Button>
      </div>
    </div>
  );
}
