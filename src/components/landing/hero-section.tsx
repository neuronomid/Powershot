"use client";

import Link from "next/link";
import Image from "next/image";
import { Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";
import { BeforeAfterDemo } from "./before-after-demo";

export function HeroSection() {
  const ref = useScrollReveal();

  return (
    <section className="relative -mt-[var(--site-header-height)] min-h-[100svh] overflow-hidden hero-gradient">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute left-1/2 top-0 h-[520px] w-full max-w-[820px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl dark:bg-[#7aadff]/8" />
        <div className="absolute left-1/4 top-1/3 h-[280px] w-[280px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl dark:bg-[#7aadff]/5" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 animate-wm-drift opacity-[0.045] dark:opacity-[0.055]"
      >
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2">
          <Image
            src="/Logos/Logo5.png"
            alt=""
            width={400}
            height={400}
            className="h-full w-full object-contain dark:hidden"
            priority={false}
          />
          <Image
            src="/Logos/Logo5-dark.png"
            alt=""
            width={400}
            height={400}
            className="hidden h-full w-full object-contain dark:block"
            priority={false}
          />
        </div>
      </div>

      <div className="mx-auto max-w-[1140px] px-[26px] pb-12 pt-28 sm:px-[52px] sm:pb-20 sm:pt-36 lg:pt-44">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-[11px] font-semibold tracking-[-0.01em] text-muted-foreground backdrop-blur-sm dark:border-white/15 dark:bg-white/[0.08] dark:text-white/70">
            <Shield className="size-3.5 shrink-0 text-primary dark:text-[#7aadff]" />
            <span>100% private · No signup · Free</span>
          </div>

          <h1 className="font-heading text-balance text-[clamp(2.5rem,6vw,5.5rem)] font-bold leading-[0.97] tracking-[-0.03em] text-foreground dark:text-white">
            From Screenshots to
            <span className="block bg-gradient-to-r from-primary via-primary to-primary/70 bg-clip-text text-transparent dark:from-[#7aadff] dark:via-[#7aadff] dark:to-[#7aadff]/70">
              organized notes, instantly
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-pretty text-base font-normal leading-[1.7] text-muted-foreground dark:text-white/60">
            Drop in any screenshot — slides, articles, receipts, dashboards, code.
            Get clean, searchable notes you can export. No account, ever.
          </p>

          <div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row sm:gap-4">
            <div className="relative w-full sm:w-auto">
              <div
                aria-hidden="true"
                className="absolute -inset-2 rounded-[1.75rem] bg-primary/15 blur-2xl dark:bg-white/15"
              />
              <Button
                asChild
                size="lg"
                className="relative isolate h-[52px] w-full gap-2 overflow-hidden rounded-full px-6 text-[15px] font-bold tracking-[-0.2px] shadow-[0_8px_28px_rgba(0,0,0,0.15)] ring-1 ring-white/30 transition-all duration-300 hover:-translate-y-0.5 hover:scale-[1.02] sm:w-auto sm:min-w-[240px] sm:px-[34px] dark:bg-white dark:text-[#0d1e38] dark:hover:bg-white/90"
              >
                <Link href="/new">
                  <span className="relative inline-flex items-center justify-center gap-2">
                    Try it free — 30 seconds
                  </span>
                </Link>
              </Button>
            </div>
            <Button
              asChild
              variant="ghost"
              size="lg"
              className="btn-cta-outline h-[52px] w-full gap-2 rounded-full px-7 text-[15px] font-semibold tracking-[-0.1px] sm:w-auto"
            >
              <Link href="/new?sample=true">
                See a sample
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-5 text-xs font-medium text-muted-foreground/70 dark:text-white/40">
            Works with PNG, JPG, HEIC, and PDF · Exports to PDF, DOCX, and
            Markdown
          </p>
        </div>
      </div>

      {/* Stats strip */}
      <div ref={ref} className="scroll-reveal">
        <div className="mx-auto max-w-[1140px] px-[26px] pb-16 sm:px-[52px] sm:pb-20 lg:pb-24">
          <div className="grid grid-cols-2 gap-3 rounded-[14px] border border-border/60 bg-card/50 p-5 backdrop-blur-sm sm:grid-cols-4 sm:gap-6 sm:p-6 dark:border-white/12 dark:bg-white/[0.06]">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[28px] font-bold tracking-[-1px] text-primary dark:text-[#7aadff]">50</div>
              <div className="text-xs font-medium leading-[1.4] text-foreground/70 dark:text-white/55">Images per note</div>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[28px] font-bold tracking-[-1px] text-primary dark:text-[#7aadff]">0</div>
              <div className="text-xs font-medium leading-[1.4] text-foreground/70 dark:text-white/55">Server uploads</div>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[28px] font-bold tracking-[-1px] text-primary dark:text-[#7aadff]">0</div>
              <div className="text-xs font-medium leading-[1.4] text-foreground/70 dark:text-white/55">Accounts needed</div>
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="text-[28px] font-bold tracking-[-1px] text-primary dark:text-[#7aadff]">4</div>
              <div className="text-xs font-medium leading-[1.4] text-foreground/70 dark:text-white/55">Export formats</div>
            </div>
          </div>
        </div>
      </div>

      {/* Before/after demo */}
      <div className="mx-auto max-w-[1140px] px-[26px] pb-16 sm:px-[52px] sm:pb-20 lg:pb-24">
        <div className="scroll-reveal" data-delay="2">
          <BeforeAfterDemo />
        </div>
      </div>
    </section>
  );
}
