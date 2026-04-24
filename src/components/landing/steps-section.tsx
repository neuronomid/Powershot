"use client";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const steps = [
  {
    num: "01",
    label: "Step one",
    title: "Drop your screenshots",
    body: "Paste, drag, or upload. PNG, JPG, HEIC, or PDF — up to 50 images per note. Order is auto-detected from filenames and metadata.",
    visual: (
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-6">
        <div className="h-2.5 w-4/5 rounded-full bg-muted" />
        <div className="h-2.5 w-full rounded-full bg-muted" />
        <div className="h-2.5 w-3/5 rounded-full bg-muted" />
        <div className="h-2.5 w-2/3 rounded-full bg-muted" />
        <div className="mt-2 flex gap-2">
          {["PNG", "JPG", "HEIC", "PDF"].map((fmt) => (
            <span key={fmt} className="rounded-md border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] font-semibold text-foreground/60">
              {fmt}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: "02",
    label: "Step two",
    title: "AI extracts & organizes",
    body: "Gemini 2.5 Pro reads every image and rebuilds the structure — headings, lists, tables, and code. Your words, never invented.",
    visual: (
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-6">
        <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-foreground/40">Extracting structure…</div>
        <div className="h-1.5 w-3/4 rounded-full bg-primary/20">
          <div className="h-full w-3/5 rounded-full bg-primary" />
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {["Headings", "Lists", "Tables", "Code blocks"].map((item) => (
            <div key={item} className="flex items-center gap-2 text-sm text-foreground/70">
              <span className="text-primary">✓</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    num: "03",
    label: "Step three",
    title: "Edit, search & export",
    body: "Polish in a split-pane editor, then export to PDF, DOCX, or Markdown with your chosen theme. Full keyboard shortcuts throughout.",
    visual: (
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/70 p-6">
        <div className="h-2.5 w-full rounded-full bg-muted" />
        <div className="h-2.5 w-4/5 rounded-full bg-muted" />
        <div className="h-2.5 w-3/5 rounded-full bg-muted" />
        <div className="mt-3 flex gap-2">
          {["PDF", "DOCX", "Markdown"].map((fmt) => (
            <span key={fmt} className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              {fmt}
            </span>
          ))}
        </div>
      </div>
    ),
  },
];

export function StepsSection() {
  const headerRef = useScrollReveal();
  const stepsRef = useScrollReveal();

  return (
    <section className="section-alt border-t border-border/40">
      <div className="section-tight mx-auto max-w-[1140px] px-[26px] sm:px-[52px]">
        <div ref={headerRef} className="max-w-2xl scroll-reveal">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px w-4 bg-primary" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              How it works
            </p>
          </div>
          <h2 className="font-heading text-[clamp(1.75rem,3.8vw,3.375rem)] font-bold tracking-[-0.02em] text-foreground">
            From screenshot to note in three steps
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            No learning curve. Drop images in, get a structured note back.
          </p>
        </div>

        <div ref={stepsRef} className="stagger-children mx-auto mt-10 flex max-w-5xl flex-col gap-0 sm:mt-14">
          {steps.map((item, i) => (
            <div key={item.num} className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-12">
              {/* Left: timeline + text */}
              <div className="flex gap-6">
                {/* Timeline column */}
                <div className="flex flex-col items-center">
                  <div className="inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                    <span className="text-sm font-bold">{item.num}</span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className="mt-2 w-px flex-1 bg-border" />
                  )}
                </div>
                {/* Text */}
                <div className="pb-12 pt-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {item.label}
                  </p>
                  <h3 className="mt-1 font-heading text-[28px] font-bold tracking-[-0.01em] text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 max-w-md text-[15px] leading-[1.7] text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </div>
              {/* Right: visual card */}
              <div className="hidden lg:block">{item.visual}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}