import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-start gap-10 px-6 py-24 sm:py-32">
      <div className="flex flex-col gap-4">
        <span className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Powershot
        </span>
        <h1 className="font-heading text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Screenshots in.
          <br />
          A clean, structured note out.
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Drop in a stack of screenshots. Powershot extracts the text, preserves
          the visual hierarchy, and hands back a polished PDF and DOCX — without
          paraphrasing or inventing a single word.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Button asChild size="lg">
          <Link href="/new">+ New note</Link>
        </Button>
        <Button asChild variant="ghost" size="lg">
          <Link href="/privacy">How we handle your data</Link>
        </Button>
      </div>
      <section className="w-full border-t border-border/60 pt-10">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent notes
        </h2>
        <p className="mt-2 text-sm text-muted-foreground/80">
          Your notes live in this browser. Create one to see it here.
        </p>
      </section>
    </div>
  );
}
