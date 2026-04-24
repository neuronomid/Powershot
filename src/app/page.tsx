"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clipboard,
  FileText,
  GraduationCap,
  History,
  ImagePlus,
  Keyboard,
  Monitor,
  MousePointerClick,
  Palette,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap,
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.markdown.toLowerCase().includes(q),
    );
  }, [notes, searchQuery]);

  const showSearch = notes.length >= 3;
  const hasNotes = !loading && notes.length > 0;

  return (
    <div className="relative isolate -mt-20 overflow-hidden pt-20">
      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                                */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute left-1/2 top-0 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute left-1/4 top-1/3 h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-20 lg:px-8 lg:pb-32 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3.5 py-1.5 text-xs font-semibold tracking-tight text-muted-foreground backdrop-blur-sm animate-in fade-in duration-700 fill-mode-both">
              <Shield className="size-3.5 text-primary" />
              100% private · No signup · Free
            </div>

            <h1 className="font-heading text-balance text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl animate-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
              Turn any screenshot into
              <span className="block bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                clean, structured notes
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base font-medium text-muted-foreground sm:text-lg md:text-xl animate-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-200">
              Drop a screenshot of a slide, article, receipt, or chat —
              Powershot extracts the text and organizes it into notes you can
              edit, search, and export. No signup. Everything stays on your
              device.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6 animate-in slide-in-from-bottom-12 duration-1000 fill-mode-both delay-300">
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-[1.75rem] bg-primary/15 blur-2xl"
                />
                <Button
                  asChild
                  size="lg"
                  variant="glossy"
                  className="relative isolate h-14 min-w-[16rem] gap-2 overflow-hidden rounded-[1.25rem] px-8 text-base font-bold tracking-tight shadow-2xl shadow-primary/30 ring-1 ring-primary/30 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-primary/40 sm:h-16 sm:px-10 sm:text-lg"
                >
                  <Link href="/new">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary via-primary to-primary/85"
                    />
                    <span className="relative inline-flex items-center justify-center gap-2">
                      <Sparkles className="size-5" />
                      Try it free — no signup
                    </span>
                  </Link>
                </Button>
              </div>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-14 gap-2 rounded-[1.25rem] px-5 text-base font-semibold text-foreground/80 hover:text-foreground sm:h-16"
              >
                <Link href="/new?sample=true">
                  Try with a sample
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <p className="mt-6 text-xs font-medium text-muted-foreground/80 animate-in fade-in duration-1000 fill-mode-both delay-500">
              Works with PNG, JPG, HEIC, and PDF · Exports to PDF, DOCX, and
              Markdown
            </p>
          </div>

          {/* Visual demo */}
          <div className="mx-auto mt-16 max-w-5xl animate-in fade-in slide-in-from-bottom-12 duration-1000 fill-mode-both delay-500 sm:mt-20">
            <BeforeAfterDemo />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border/40 bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              How it works
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              From screenshot to note in three steps
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              No learning curve. Drop images in, get a structured note back.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-6 sm:mt-20 sm:grid-cols-3 sm:gap-8">
            <StepCard
              step={1}
              icon={<Upload className="size-6" />}
              title="Drop your screenshots"
              body="Paste, drag, or upload. PNG, JPG, HEIC, or PDF — up to 50 images per note."
            />
            <StepCard
              step={2}
              icon={<Wand2 className="size-6" />}
              title="AI extracts & organizes"
              body="Gemini 2.5 Pro reads every image and rebuilds the structure — headings, lists, tables, and code."
            />
            <StepCard
              step={3}
              icon={<FileText className="size-6" />}
              title="Edit, search & export"
              body="Polish in a split-pane editor, then export to PDF, DOCX, or Markdown with your chosen theme."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              What you get
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Built for the way you actually capture
            </h2>
            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              A handful of deliberate features — each one pulling its weight.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-6xl gap-5 sm:mt-20 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<Clipboard className="size-5" />}
              title="Paste, drag, or pick"
              body="Hit Cmd+V anywhere on the upload page, drag a folder of screenshots, or open the file picker. It just works."
            />
            <FeatureCard
              icon={<Sparkles className="size-5" />}
              title="Never paraphrased"
              body="A token-subset guardrail verifies the AI output is a strict subset of what was in your screenshots. Your words, never invented."
            />
            <FeatureCard
              icon={<MousePointerClick className="size-5" />}
              title="Split-pane editor"
              body="Source images on one side, editable Markdown on the other. Sync scroll keeps context tight while you polish."
            />
            <FeatureCard
              icon={<Palette className="size-5" />}
              title="Four themes, fully tunable"
              body="Classic, Modern, Sepia, or Minimal — plus font, size, spacing, margins, and page size. Change once, export everywhere."
            />
            <FeatureCard
              icon={<FileText className="size-5" />}
              title="Export to PDF & DOCX"
              body="Native Word tables and real heading styles — not screenshots of text. Copy Markdown for anywhere else."
            />
            <FeatureCard
              icon={<Shield className="size-5" />}
              title="Private by architecture"
              body="Images flow through memory only. Notes live in your browser's IndexedDB. Nothing persisted server-side, ever."
            />
            <FeatureCard
              icon={<Wand2 className="size-5" />}
              title="Auto-ordering & dedup"
              body="Screenshots are sorted by filename, EXIF, or capture time, then overlapping seams are stitched back together automatically."
            />
            <FeatureCard
              icon={<ImagePlus className="size-5" />}
              title="PDF and HEIC in"
              body="Multi-page PDFs are rendered per-page before extraction. iPhone HEIC screenshots work out of the box."
            />
            <FeatureCard
              icon={<Keyboard className="size-5" />}
              title="Keyboard-first"
              body="Full keyboard reordering on the filmstrip, shortcuts for the editor, accessible focus states throughout."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Who it's for                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border/40 bg-card/20">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Who it&apos;s for
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              If you screenshot things, this is for you
            </h2>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4">
            <AudienceCard
              icon={<GraduationCap className="size-5" />}
              title="Students"
              body="Snap lecture slides, get organized study notes you can search and export."
            />
            <AudienceCard
              icon={<Search className="size-5" />}
              title="Researchers"
              body="Capture articles and papers, build a searchable knowledge base in your browser."
            />
            <AudienceCard
              icon={<Monitor className="size-5" />}
              title="Professionals"
              body="Turn screenshots of meetings, dashboards, or docs into notes you can share."
            />
            <AudienceCard
              icon={<FileText className="size-5" />}
              title="Readers"
              body="Save what matters from anything on your screen — without retyping a word."
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Why Powershot (benefits)                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                Why Powershot
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                No account. No upload. No excuses.
              </h2>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Most screenshot-to-notes tools ask you to sign up, upload your
                data, and trust their cloud. Powershot does the opposite.
              </p>
              <div className="mt-8">
                <Button
                  asChild
                  size="lg"
                  variant="glossy"
                  className="h-12 gap-2 rounded-xl px-6 text-sm font-semibold shadow-lg shadow-primary/20 ring-1 ring-primary/20"
                >
                  <Link href="/new">
                    Get started — free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>

            <ul className="space-y-4">
              <BenefitRow
                icon={<Shield className="size-5" />}
                title="100% private"
                body="Your screenshots and notes never leave your browser. No server storage, no account, no tracking of content."
              />
              <BenefitRow
                icon={<Zap className="size-5" />}
                title="No signup, no email"
                body="Open the site, drop a screenshot, get your notes. That&apos;s it — nothing to remember, nothing to unsubscribe from."
              />
              <BenefitRow
                icon={<Sparkles className="size-5" />}
                title="Works with anything"
                body="Slides, articles, receipts, chats, code, handwriting — if you can screenshot it, Powershot can read it."
              />
              <BenefitRow
                icon={<FileText className="size-5" />}
                title="Free to use"
                body="Built by one person who got tired of retyping things from screenshots. Keep it simple, keep it free."
              />
            </ul>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Recent notes (returning users)                                      */}
      {/* ------------------------------------------------------------------ */}
      {hasNotes && (
        <section className="border-t border-border/40 bg-card/20">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  <History className="size-7 text-primary" />
                  Your recent notes
                </h2>
                <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
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
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notes…"
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
            </div>

            {error && (
              <div className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center">
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

            <div className="mt-8 grid grid-cols-1 gap-6 sm:mt-10 sm:grid-cols-2 lg:grid-cols-3">
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
                        onClick={() => setSearchQuery("")}
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
                    <Card className="relative h-full overflow-hidden bg-card/50 ring-1 ring-border/50 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-primary/5">
                      <CardContent className="flex flex-col gap-3 p-6">
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
                        <p className="text-xs font-medium text-muted-foreground">
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
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Final CTA                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="border-t border-border/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-primary/5 p-10 text-center shadow-xl shadow-primary/5 sm:p-16">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Ready to turn screenshots into notes?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
                Give it 30 seconds. Drop in a screenshot and see what comes
                back.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button
                  asChild
                  size="lg"
                  variant="glossy"
                  className="h-14 min-w-[14rem] gap-2 rounded-xl px-8 text-base font-bold shadow-lg shadow-primary/25 ring-1 ring-primary/25"
                >
                  <Link href="/new">
                    <Sparkles className="size-5" />
                    Create your first note
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="ghost"
                  size="lg"
                  className="h-14 gap-2 rounded-xl px-5 text-base font-semibold text-foreground/80 hover:text-foreground"
                >
                  <Link href="/new?sample=true">
                    Or try with a sample
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  step,
  icon,
  title,
  body,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          {icon}
        </div>
        <span className="font-heading text-sm font-bold tracking-[0.18em] text-muted-foreground">
          STEP {step}
        </span>
      </div>
      <h3 className="font-heading text-lg font-bold tracking-tight text-foreground sm:text-xl">
        {title}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
        {body}
      </p>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="group relative rounded-2xl border border-border/60 bg-card/50 p-6 transition-all hover:border-primary/30 hover:bg-card hover:shadow-md hover:shadow-primary/5">
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-105">
        {icon}
      </div>
      <h3 className="font-heading text-base font-bold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}

function AudienceCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-background p-6 transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5">
      <div className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        {icon}
      </div>
      <h3 className="font-heading text-base font-bold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function BenefitRow({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4 rounded-xl p-3 transition-colors hover:bg-card/50">
      <div className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
        {icon}
      </div>
      <div>
        <h3 className="font-heading text-base font-bold tracking-tight text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

function BeforeAfterDemo() {
  return (
    <div className="relative rounded-3xl border border-border/60 bg-card/40 p-3 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch sm:gap-4">
        {/* Before: messy screenshot */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="inline-flex size-1.5 rounded-full bg-muted-foreground/50" />
              Screenshot in
            </div>
            <div className="flex gap-1">
              <span className="size-2 rounded-full bg-muted-foreground/30" />
              <span className="size-2 rounded-full bg-muted-foreground/30" />
              <span className="size-2 rounded-full bg-muted-foreground/30" />
            </div>
          </div>
          <div className="relative aspect-[4/3] w-full bg-gradient-to-br from-muted/40 to-muted/10">
            <Image
              src="/samples/lecture-slide.svg"
              alt="Example lecture slide screenshot"
              fill
              sizes="(min-width: 640px) 400px, 100vw"
              className="object-cover"
            />
          </div>
        </div>

        {/* Arrow between */}
        <div className="flex items-center justify-center py-2 sm:py-0">
          <div className="inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-primary/20 sm:size-14">
            <Wand2 className="size-5 sm:size-6" />
          </div>
        </div>

        {/* After: structured note */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
          <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <span className="inline-flex size-1.5 rounded-full bg-primary" />
              Structured note out
            </div>
            <div className="flex gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground">
              <span className="rounded bg-muted px-1.5 py-0.5">MD</span>
              <span className="rounded bg-muted px-1.5 py-0.5">PDF</span>
              <span className="rounded bg-muted px-1.5 py-0.5">DOCX</span>
            </div>
          </div>
          <div className="flex aspect-[4/3] w-full flex-col gap-2.5 overflow-hidden p-5 text-left">
            <div className="text-sm font-heading font-bold text-foreground">
              # Distributed Systems: CAP Theorem
            </div>
            <div className="text-[11px] text-muted-foreground">
              ## Core Trade-offs
            </div>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              <li className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  <span className="font-semibold text-foreground">
                    Consistency
                  </span>
                  {" "}— every read sees the latest write
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  <span className="font-semibold text-foreground">
                    Availability
                  </span>
                  {" "}— every request returns a response
                </span>
              </li>
              <li className="flex gap-1.5">
                <span className="text-primary">•</span>
                <span>
                  <span className="font-semibold text-foreground">
                    Partition tolerance
                  </span>
                  {" "}— system survives network splits
                </span>
              </li>
            </ul>
            <div className="mt-auto flex items-center gap-2 border-t border-border/40 pt-2 text-[10px] font-semibold text-muted-foreground">
              <Sparkles className="size-3 text-primary" />
              Extracted · Never paraphrased
            </div>
          </div>
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
