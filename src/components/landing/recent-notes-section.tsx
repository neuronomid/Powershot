"use client";

import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  History,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import type { Note } from "@/lib/note/types";

interface RecentNotesSectionProps {
  notes: Note[];
  loading: boolean;
  error: string | null;
  isQuotaError: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onDeleteOldest: () => void;
}

export function RecentNotesSection({
  notes,
  loading,
  error,
  isQuotaError,
  searchQuery,
  onSearchChange,
  onDelete,
  onDeleteOldest,
}: RecentNotesSectionProps) {
  const ref = useScrollReveal();
  const hasNotes = !loading && notes.length > 0;
  const showSearch = notes.length >= 3;

  const filteredNotes = (() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.markdown.toLowerCase().includes(q),
    );
  })();

  if (!hasNotes) return null;

  return (
    <section className="section-alt border-t border-border/40">
      <div ref={ref} className="section-tight mx-auto max-w-[1140px] px-[26px] sm:px-[52px]">
        <div className="scroll-reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-[-0.02em] text-foreground">
              <History className="size-7 text-primary" />
              Your recent notes
            </h2>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Access your previously generated notes. Everything stays
              local to your browser.
            </p>
          </div>
          {showSearch && (
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search notes…"
                className="w-full rounded-[10px] border border-border/60 bg-background pl-9 pr-9 py-2.5 text-sm font-medium text-foreground backdrop-blur-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="scroll-reveal mt-6 flex flex-col items-start gap-3 rounded-[10px] border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 shrink-0" />
              {error}
            </div>
            {isQuotaError && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDeleteOldest}
                className="rounded-full border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/10"
              >
                Delete oldest note
              </Button>
            )}
          </div>
        )}

        <div className="stagger-children mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3 sm:gap-5">
          {filteredNotes.length === 0 && searchQuery ? (
            <Card className="lg:col-span-3">
              <CardContent className="p-8">
                <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
                  <div className="rounded-full bg-muted p-4">
                    <FileText className="size-8 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground">
                      No notes match your search
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Try a different keyword or clear your search.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSearchChange("")}
                    className="rounded-full"
                  >
                    Clear search
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            filteredNotes.map((note) => (
              <Link
                key={note.id}
                href={`/note/${note.id}`}
                className="group block"
              >
                <Card className="relative h-full overflow-hidden rounded-[12px] bg-card/50 ring-1 ring-border/50 backdrop-blur-sm transition-all duration-300 hover:-translate-y-[2px] hover:shadow-xl hover:shadow-primary/5">
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-heading text-[14px] font-bold tracking-[-0.2px] text-foreground line-clamp-2">
                        {note.title}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => onDelete(note.id, e)}
                        className="shrink-0 rounded-full p-1.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete note"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    <p className="text-[11px] font-medium text-muted-foreground/70">
                      {formatDate(note.updatedAt)}
                    </p>
                    <p className="text-[12px] leading-[1.55] text-muted-foreground line-clamp-3">
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
    </section>
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