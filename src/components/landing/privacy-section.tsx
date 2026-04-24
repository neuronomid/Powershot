"use client";

import { Lock, Zap, Sparkles } from "lucide-react";
import { useScrollReveal, useCountUp } from "@/hooks/use-scroll-reveal";

export function PrivacySection() {
  const headerRef = useScrollReveal();

  return (
    <section className="section-alt border-t border-border/40">
      <div className="section-tight mx-auto max-w-[1140px] px-[26px] sm:px-[52px]">
        <div ref={headerRef} className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div className="scroll-reveal">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-px w-4 bg-primary" />
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">
                Why Powershot
              </p>
            </div>
            <h2 className="font-heading text-[clamp(1.75rem,3.8vw,3.375rem)] font-bold tracking-[-0.02em] text-foreground">
              No account.
              <br />
              No upload.
              <br />
              No excuses.
            </h2>
            <p className="mt-4 text-base leading-[1.7] text-muted-foreground">
              Most screenshot-to-notes tools ask you to sign up, upload your data, and trust their cloud. Powershot does the opposite.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Lock className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">100% private</h4>
                  <p className="text-sm text-muted-foreground">Your screenshots and notes never leave your browser. No server storage, no account, no tracking.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">No signup, no email</h4>
                  <p className="text-sm text-muted-foreground">Open the site, drop a screenshot, get your notes. Nothing to remember, nothing to unsubscribe from.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Works with anything</h4>
                  <p className="text-sm text-muted-foreground">Slides, articles, receipts, chats, code, handwriting — if you can screenshot it, Powershot can read it.</p>
                </div>
              </div>
            </div>
          </div>

          <PrivacyVisual />
        </div>
      </div>
    </section>
  );
}

function PrivacyVisual() {
  const countRef = useCountUp(0, 800);

  return (
    <div className="scroll-reveal" data-delay="2">
      <div className="relative flex min-h-[320px] flex-col items-center justify-center overflow-hidden rounded-[18px] p-8 sm:min-h-[420px] sm:p-10 privacy-visual">
        <div className="relative z-10 text-center">
          <div
            ref={countRef}
            className="text-[88px] font-bold leading-none tracking-[-4px] text-[#7aadff]"
          >
            0
          </div>
          <div className="mt-3 text-sm font-medium text-white/70 sm:text-base">
            bytes sent to any server
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
          <span className="rounded-[100px] border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/60 sm:text-sm">
            Local-only
          </span>
          <span className="rounded-[100px] border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/60 sm:text-sm">
            No server
          </span>
          <span className="rounded-[100px] border border-[#7aadff]/35 bg-[#7aadff]/[0.08] px-3 py-1.5 text-xs font-semibold text-[#7aadff] sm:text-sm">
            IndexedDB
          </span>
          <span className="rounded-[100px] border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/60 sm:text-sm">
            No tracking
          </span>
          <span className="rounded-[100px] border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-white/60 sm:text-sm">
            No cookies
          </span>
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute left-1/4 top-1/4 h-[200px] w-[200px] rounded-full bg-[#7aadff]/[0.06] blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-1/4 right-1/4 h-[160px] w-[160px] rounded-full bg-[#7aadff]/[0.04] blur-3xl" />
      </div>
    </div>
  );
}