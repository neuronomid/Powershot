"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export function CtaSection() {
  const ref = useScrollReveal();

  return (
    <section className="border-t border-border/40">
      <div className="section-tight mx-auto max-w-[1140px] px-[26px] sm:px-[52px]">
        <div
          ref={ref}
          className="scroll-reveal relative overflow-hidden rounded-[16px] border border-border/60 p-8 text-center sm:rounded-[18px] sm:p-12 md:p-14 cta-gradient dark:border-white/10"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
          >
            <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl dark:bg-[#7aadff]/10" />
            <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl dark:bg-[#7aadff]/8" />
          </div>

          <div className="relative">
            <h2 className="font-heading text-balance text-[clamp(1.75rem,4vw,3.25rem)] font-bold tracking-[-0.02em] text-foreground dark:text-white">
              Ready to turn screenshots into notes?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground dark:text-white/60">
              Give it 30 seconds. Drop in a screenshot and see what comes
              back.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <div className="relative w-full sm:w-auto">
                <div
                  aria-hidden="true"
                  className="absolute -inset-2 rounded-[14px] bg-primary/15 blur-2xl dark:bg-white/15"
                />
                <Button
                  asChild
                  size="lg"
                  className="relative isolate h-[52px] w-full gap-2 rounded-full px-7 text-[15px] font-bold tracking-[-0.2px] shadow-[0_8px_28px_rgba(0,0,0,0.15)] ring-1 ring-white/30 sm:h-[52px] sm:w-auto sm:min-w-[220px] animate-btn-pulse dark:bg-white dark:text-[#0d1e38] dark:hover:bg-white/90"
                >
                  <Link href="/new">
                    <Sparkles className="size-5 shrink-0" />
                    Create your first note
                  </Link>
                </Button>
              </div>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="h-[52px] w-full gap-2 rounded-full border-[1.5px] border-transparent px-7 text-[15px] font-semibold tracking-[-0.1px] text-foreground/75 hover:text-foreground sm:w-auto dark:border-white/20 dark:text-white/75 dark:hover:text-white"
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
  );
}