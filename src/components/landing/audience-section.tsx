"use client";

import { GraduationCap, Search, Monitor, FileText } from "lucide-react";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const audiences = [
  {
    num: "01",
    icon: <GraduationCap className="size-5" />,
    title: "Students",
    body: "Snap lecture slides, get organized study notes you can search and export.",
  },
  {
    num: "02",
    icon: <Search className="size-5" />,
    title: "Researchers",
    body: "Capture articles and papers, build a searchable knowledge base in your browser.",
  },
  {
    num: "03",
    icon: <Monitor className="size-5" />,
    title: "Professionals",
    body: "Turn screenshots of meetings, dashboards, or docs into notes you can share.",
  },
  {
    num: "04",
    icon: <FileText className="size-5" />,
    title: "Readers",
    body: "Save what matters from anything on your screen — without retyping a word.",
  },
];

export function AudienceSection() {
  const headerRef = useScrollReveal();
  const cardsRef = useScrollReveal();

  return (
    <section className="border-t border-border/40">
      <div className="section-tight mx-auto max-w-[1140px] px-[26px] sm:px-[52px]">
        <div ref={headerRef} className="max-w-2xl scroll-reveal">
          <div className="mb-3 flex items-center gap-2">
            <div className="h-px w-4 bg-primary" />
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
              Who it&apos;s for
            </p>
          </div>
          <h2 className="font-heading text-[clamp(1.75rem,3.8vw,3.375rem)] font-bold tracking-[-0.02em] text-foreground">
            If you screenshot things, this is for you
          </h2>
        </div>

        <div ref={cardsRef} className="stagger-children mx-auto mt-10 grid max-w-5xl gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
          {audiences.map((item) => (
            <AudienceCard key={item.title} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceCard({
  num,
  title,
  body,
}: {
  num: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex flex-col gap-2.5 rounded-[14px] border border-border/60 bg-background p-6 transition-[transform,border-color,box-shadow] duration-[0.22s] hover:-translate-y-[3px] hover:border-primary/30 hover:shadow-md sm:p-7">
      <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
        {num}
      </span>
      <h3 className="font-heading text-[17px] font-bold tracking-[-0.3px] text-foreground">
        {title}
      </h3>
      <p className="text-[13px] leading-[1.62] text-muted-foreground">
        {body}
      </p>
    </div>
  );
}