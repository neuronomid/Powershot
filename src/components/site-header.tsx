"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const isDecks = pathname?.startsWith("/decks") ?? false;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-[background,border-color,box-shadow,backdrop-filter] duration-400",
        scrolled
          ? "bg-background/80 shadow-sm backdrop-blur-[22px] saturate-150"
          : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1140px] items-center justify-between gap-2 px-[26px] sm:px-[52px]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90 sm:gap-2.5"
        >
          <div className="relative size-8 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-border/20">
            <Image
              src="/Logos/Logo5.png"
              alt="Powershot Logo"
              fill
              sizes="32px"
              className="object-cover"
              priority
            />
          </div>
          <span className="hidden font-heading text-[17px] font-bold tracking-[-0.01em] text-foreground/90 min-[380px]:inline">
            Powershot
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div
            className={cn(
              "hidden rounded-full p-[3px] sm:inline-flex",
              scrolled
                ? "border border-border/60 bg-card/60 shadow-sm"
                : "border border-border/40 bg-card/40",
              "shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]",
            )}
          >
            <Link
              href="/"
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-semibold tracking-[-0.1px] transition-colors",
                !isDecks
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Notes
            </Link>
            <Link
              href="/decks"
              className={cn(
                "rounded-full px-4 py-1.5 text-[13px] font-semibold tracking-[-0.1px] transition-colors",
                isDecks
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Flashcards
            </Link>
          </div>

          <Button
            asChild
            size="sm"
            variant="glossy"
            className="h-8 rounded-full px-4 text-[13px] font-semibold tracking-[-0.1px] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_8px_rgba(59,126,245,0.4)]"
          >
            <Link
              href={isDecks ? "/decks/new" : "/new"}
              aria-label={isDecks ? "Create new deck" : "Create new note"}
            >
              <span aria-hidden="true" className="sm:hidden">+</span>
              <span className="sr-only sm:not-sr-only">
                {isDecks ? "+ New Deck" : "+ New Note"}
              </span>
            </Link>
          </Button>
          <div className="hidden h-4 w-px bg-border/60 sm:block" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}