"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <section className="relative overflow-hidden hero-gradient">
      {/* Logo watermark centered in the upper portion */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[40px] w-[460px] max-w-[80vw] -translate-x-1/2 sm:w-[520px]"
      >
        <div
          className="aspect-square w-full bg-contain bg-center bg-no-repeat opacity-[0.12] dark:hidden"
          style={{ backgroundImage: "url('/Logos/Logo5.png')" }}
        />
        <div
          className="hidden aspect-square w-full bg-contain bg-center bg-no-repeat opacity-[0.12] dark:block"
          style={{ backgroundImage: "url('/Logos/Logo5-dark.png')" }}
        />
      </div>

      <div className="relative mx-auto max-w-[1140px] px-[26px] pb-[72px] pt-[440px] text-center sm:px-[52px] sm:pt-[500px]">
        <h2 className="font-heading text-balance text-[clamp(1.75rem,4vw,3.25rem)] font-bold tracking-[-0.02em] text-foreground dark:text-white">
          Ready to turn screenshots into notes?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground dark:text-white/60">
          Give it 30 seconds. Drop in a screenshot and see what comes back.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button
            asChild
            size="lg"
            className="btn-cta-white relative h-[52px] w-full gap-2 rounded-full px-8 text-[15px] font-bold tracking-[-0.2px] sm:w-auto sm:min-w-[220px]"
          >
            <Link href="/new">
              <Sparkles className="size-5 shrink-0" />
              Create your first note
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="lg"
            className="btn-cta-outline h-[52px] w-full gap-2 rounded-full px-8 text-[15px] font-semibold tracking-[-0.1px] sm:w-auto"
          >
            <Link href="/new?sample=true">
              Try with a sample
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
