"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  History,
  Trash2,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { listNotes, deleteNote, deleteOldestNote, QuotaExceededError } from "@/lib/note/store";
import type { Note } from "@/lib/note/types";

export default function HomePage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuotaError, setIsQuotaError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    listNotes()
      .then((all) => {
        if (cancelled) return;
        setNotes(all);
        setError(null);
        setIsQuotaError(false);
      })
      .catch((err) => {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load notes from local storage.";
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
    async (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!confirm("Delete this note? This cannot be undone.")) return;
      await deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    },
    [],
  );

  const handleDeleteOldest = useCallback(async () => {
    const deletedId = await deleteOldestNote();
    if (deletedId) {
      setNotes((prev) => prev.filter((n) => n.id !== deletedId));
      setError(null);
      setIsQuotaError(false);
    }
  }, []);

  return (
    <div className="relative isolate -mt-20 overflow-hidden pt-16 sm:pt-20">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pb-24 sm:pt-10 lg:px-8 lg:pb-32 lg:pt-40">
        <div className="mx-auto max-w-2xl lg:max-w-4xl text-center">
          <h1 className="mt-16 sm:mt-24 lg:mt-16 font-heading text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-7xl lg:text-8xl animate-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
            Your notes
          </h1>
          <p className="mx-auto mt-4 sm:mt-8 text-pretty text-base sm:text-lg font-medium text-muted-foreground sm:text-xl/8 max-w-2xl animate-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-200">
            Everything stays local to your browser. Create, edit, and export
            structured notes from screenshots.
          </p>
          <div className="mt-8 sm:mt-12 flex items-center justify-center gap-x-6 animate-in slide-in-from-bottom-12 duration-1000 fill-mode-both delay-300">
            <div className="relative">
              <div
                aria-hidden="true"
                className="absolute -inset-2 rounded-[1.75rem] bg-primary/15 blur-2xl transition-opacity duration-300"
              />
              <Button
                asChild
                size="lg"
                variant="glossy"
                className="relative isolate h-14 min-w-[11rem] gap-3 overflow-hidden rounded-[1.25rem] px-7 text-base font-bold tracking-tight shadow-2xl shadow-primary/30 ring-1 ring-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.03] hover:shadow-primary/40 sm:min-w-[15rem] sm:h-16 sm:px-12 sm:text-lg"
              >
                <Link href="/new">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary via-primary to-primary/85"
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -left-16 top-0 h-full w-12 -skew-x-12 bg-primary-foreground/25 opacity-70 transition-transform duration-700 group-hover/button:translate-x-[19rem]"
                  />
                  <span className="relative inline-flex w-full items-center justify-center text-center">
                    + New Note
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Recent notes */}
      <div className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
            <History className="size-8 text-primary" />
            Recent notes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground font-medium">
            Access your previously generated notes. Everything stays local to
            your browser.
          </p>
        </div>

        {error && (
          <div className="mx-auto mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-lg bg-destructive/5 border border-destructive/20 px-4 py-3 text-sm text-destructive">
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
                Delete oldest note
              </Button>
            )}
          </div>
        )}

        <div className="mx-auto mt-8 sm:mt-12 grid max-w-2xl grid-cols-1 gap-x-6 gap-y-6 border-t border-border/60 pt-8 sm:mt-16 sm:gap-x-8 sm:gap-y-8 sm:pt-10 md:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card
                key={i}
                className="animate-pulse bg-card/50 backdrop-blur-sm"
              >
                <CardContent className="p-6">
                  <div className="h-5 w-3/4 rounded bg-muted" />
                  <div className="mt-3 h-4 w-1/2 rounded bg-muted" />
                </CardContent>
              </Card>
            ))
          ) : notes.length === 0 ? (
            <Card className="group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 ring-1 ring-border/50 bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                  <div className="rounded-full bg-muted p-4 transition-colors group-hover:bg-primary/10">
                    <FileText className="size-8 text-muted-foreground transition-colors group-hover:text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      No notes yet
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Your generated notes will appear here.
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="mt-4 rounded-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                  >
                    <Link href="/new">Create your first note</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            notes.map((note) => (
              <Link
                key={note.id}
                href={`/note/${note.id}`}
                className="group block"
              >
                <Card className="relative overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 ring-1 ring-border/50 bg-card/50 backdrop-blur-sm h-full">
                  <CardContent className="p-6 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading text-base font-semibold text-foreground line-clamp-2">
                        {note.title}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(note.id, e)}
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete note"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      {formatDate(note.updatedAt)}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {note.markdown.slice(0, 180).replace(/\n/g, " ")}
                      {note.markdown.length > 180 ? "…" : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

      </div>
    </div>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
