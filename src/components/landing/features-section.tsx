"use client";

import {
  Clipboard,
  Sparkles,
  MousePointerClick,
  Palette,
  FileText,
  Shield,
  Wand2,
  ImagePlus,
  Keyboard,
} from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const features = [
  {
    icon: <Clipboard className="size-5" />,
    title: "Paste, drag, or pick",
    body: "Hit Cmd+V anywhere on the upload page, drag a folder of screenshots, or open the file picker. It just works.",
  },
  {
    icon: <Sparkles className="size-5" />,
    title: "Never paraphrased",
    body: "A token-subset guardrail verifies the AI output is a strict subset of what was in your screenshots. Your words, never invented.",
  },
  {
    icon: <MousePointerClick className="size-5" />,
    title: "Split-pane editor",
    body: "Source images on one side, editable Markdown on the other. Sync scroll keeps context tight while you polish.",
  },
  {
    icon: <Palette className="size-5" />,
    title: "Four themes, fully tunable",
    body: "Classic, Modern, Sepia, or Minimal — plus font, size, spacing, margins, and page size. Change once, export everywhere.",
  },
  {
    icon: <FileText className="size-5" />,
    title: "Export to PDF & DOCX",
    body: "Native Word tables and real heading styles — not screenshots of text. Copy Markdown for anywhere else.",
  },
  {
    icon: <Shield className="size-5" />,
    title: "Private by architecture",
    body: "Images flow through memory only. Notes live in your browser's IndexedDB. Nothing persisted server-side, ever.",
  },
  {
    icon: <Wand2 className="size-5" />,
    title: "Auto-ordering & dedup",
    body: "Screenshots are sorted by filename, EXIF, or capture time, then overlapping seams are stitched back together automatically.",
  },
  {
    icon: <ImagePlus className="size-5" />,
    title: "PDF and HEIC in",
    body: "Multi-page PDFs are rendered per-page before extraction. iPhone HEIC screenshots work out of the box.",
  },
  {
    icon: <Keyboard className="size-5" />,
    title: "Keyboard-first",
    body: "Full keyboard reordering on the filmstrip, shortcuts for the editor, accessible focus states throughout.",
  },
];

export function FeaturesSection() {
  const headerRef = useScrollReveal();
  const gridRef = useScrollReveal();

  return (
    <section className="border-t border-border/40">
      <div className="section-tight mx-auto max-w-[1140px] px-[26px] sm:px-[52px]">
        <div ref={headerRef} className="max-w-2xl scroll-reveal">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px w-4 bg-primary" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              What you get
            </p>
          </div>
          <h2 className="font-heading text-[clamp(1.75rem,3.8vw,3.375rem)] font-bold tracking-[-0.02em] text-foreground">
            Built for the way you actually capture
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            A handful of deliberate features — each one pulling its weight.
          </p>
        </div>

        <div ref={gridRef} className="stagger-children mx-auto mt-10 grid max-w-5xl gap-px rounded-[16px] border border-border/60 bg-border/60 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
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
    <div className="group bg-background p-[28px_26px] transition-colors duration-200 hover:bg-accent">
      <div className="mb-4 inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20 transition-transform group-hover:scale-105">
        {icon}
      </div>
      <h3 className="text-[14px] font-bold tracking-[-0.2px] text-foreground">
        {title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-[1.62] text-muted-foreground">
        {body}
      </p>
    </div>
  );
}