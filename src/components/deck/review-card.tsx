"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Card } from "@/lib/flashcard/types";
import { readMediaAsDataUrl } from "@/lib/flashcard/media";

type Props = {
  card: Card;
  onGrade: (grade: "again" | "hard" | "good" | "easy") => void;
  flipped: boolean;
  onFlip: () => void;
};

export function ReviewCard({ card, onGrade, flipped, onFlip }: Props) {
  const [frontMedia, setFrontMedia] = useState<string | null>(null);
  const [backMedia, setBackMedia] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!card.mediaRefs || card.mediaRefs.length === 0) {
        setFrontMedia(null);
        setBackMedia(null);
        return;
      }
      for (const ref of card.mediaRefs) {
        const data = await readMediaAsDataUrl(ref.mediaId);
        if (cancelled) return;
        if (ref.role === "front") setFrontMedia(data);
        else setBackMedia(data);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [card]);

  return (
    <div className="flex flex-col gap-6">
      <div
        role="button"
        tabIndex={0}
        onClick={onFlip}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            onFlip();
          }
        }}
        className="relative min-h-[260px] cursor-pointer rounded-3xl border border-border/60 bg-card p-8 shadow-xl transition-shadow hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="absolute left-4 top-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span>{card.style}</span>
          <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
          <span>{card.difficulty}</span>
          {card.guardrailViolations && card.guardrailViolations.length > 0 && (
            <>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/60" />
              <span className="text-amber-500">⚠ needs review</span>
            </>
          )}
        </div>
        <div className="pt-10">
          {flipped ? (
            card.model === "cloze" ? (
              <ClozeBack front={card.front} extra={card.extra} />
            ) : (
              <BackPane back={card.back} extra={card.extra} mediaUrl={backMedia} />
            )
          ) : card.model === "cloze" ? (
            <ClozeFront front={card.front} mediaUrl={frontMedia} />
          ) : (
            <FrontPane front={card.front} mediaUrl={frontMedia} />
          )}
        </div>
        <p className="absolute bottom-3 right-4 text-[10px] font-semibold text-muted-foreground/60">
          {flipped ? "click to hide answer" : "click to reveal"}
        </p>
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          <GradeButton grade="again" label="Again" onClick={() => onGrade("again")} />
          <GradeButton grade="hard" label="Hard" onClick={() => onGrade("hard")} />
          <GradeButton grade="good" label="Good" onClick={() => onGrade("good")} />
          <GradeButton grade="easy" label="Easy" onClick={() => onGrade("easy")} />
        </div>
      ) : (
        <Button
          type="button"
          variant="glossy"
          onClick={onFlip}
          className="h-11 rounded-full font-bold"
        >
          Show answer
        </Button>
      )}
    </div>
  );
}

function GradeButton({
  grade,
  label,
  onClick,
}: {
  grade: "again" | "hard" | "good" | "easy";
  label: string;
  onClick: () => void;
}) {
  const palette: Record<typeof grade, string> = {
    again: "bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20 dark:text-red-400",
    hard: "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-amber-500/20 dark:text-amber-400",
    good: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20 dark:text-emerald-400",
    easy: "bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 border-sky-500/20 dark:text-sky-400",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border px-3 py-3 text-sm font-bold transition-colors",
        palette[grade],
      )}
    >
      {label}
    </button>
  );
}

function FrontPane({ front, mediaUrl }: { front: string; mediaUrl: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      {mediaUrl && (
        <Image
          src={mediaUrl}
          alt="Card media"
          width={800}
          height={400}
          unoptimized
          className="max-h-64 w-full rounded-xl border border-border/60 object-contain"
        />
      )}
      <p className="whitespace-pre-wrap text-xl font-semibold leading-snug text-foreground">
        {front}
      </p>
    </div>
  );
}

function BackPane({
  back,
  extra,
  mediaUrl,
}: {
  back: string;
  extra: string | undefined;
  mediaUrl: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {mediaUrl && (
        <Image
          src={mediaUrl}
          alt="Card media"
          width={800}
          height={400}
          unoptimized
          className="max-h-64 w-full rounded-xl border border-border/60 object-contain"
        />
      )}
      <p className="whitespace-pre-wrap text-xl font-semibold leading-snug text-foreground">
        {back}
      </p>
      {extra && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {extra}
        </p>
      )}
    </div>
  );
}

function ClozeFront({ front, mediaUrl }: { front: string; mediaUrl: string | null }) {
  const hidden = front.replace(/\{\{c\d+::([^}]+?)(?:::([^}]*))?\}\}/g, (_, _ans, hint) => {
    return hint ? `[… ${hint} …]` : "[…]";
  });
  return <FrontPane front={hidden} mediaUrl={mediaUrl} />;
}

function ClozeBack({ front, extra }: { front: string; extra: string | undefined }) {
  const revealed = front.replace(
    /\{\{c\d+::([^}]+?)(?:::[^}]*)?\}\}/g,
    (_, ans) => `**${ans}**`,
  );
  return (
    <div className="flex flex-col gap-4">
      <p className="whitespace-pre-wrap text-xl font-semibold leading-snug text-foreground">
        {revealed.split("**").map((part, i) =>
          i % 2 === 1 ? (
            <span key={i} className="rounded bg-primary/15 px-1 text-primary">
              {part}
            </span>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </p>
      {extra && (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {extra}
        </p>
      )}
    </div>
  );
}
