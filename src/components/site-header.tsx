"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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

  const newHref = isDecks ? "/decks/new" : "/new";
  const newLabel = isDecks ? "+ New Deck" : "+ New Note";

  return (
    <header
      className={cn(
        "nav-design fixed top-0 left-0 right-0 z-50 w-full",
        scrolled && "scrolled",
      )}
    >
      <div className="mx-auto flex h-[68px] w-full max-w-[1140px] items-center justify-between gap-2 px-5 sm:px-[52px]">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-1 transition-opacity hover:opacity-90"
          aria-label="Powershot home"
        >
          <div className="relative block size-14 shrink-0 sm:size-16 dark:hidden">
            <Image
              src="/Logos/Logo5.png"
              alt=""
              fill
              sizes="64px"
              priority
              className="object-contain"
            />
          </div>
          <div className="relative hidden size-14 shrink-0 sm:size-16 dark:block">
            <Image
              src="/Logos/Logo5-dark.png"
              alt=""
              fill
              sizes="64px"
              priority
              className="object-contain"
            />
          </div>
          <span className="font-heading -ml-4 text-[18px] font-bold tracking-[-0.02em] text-[#1e3560] sm:-ml-5 sm:text-[22px] dark:text-white">
            Powershot
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          <div className="nav-pill inline-flex items-center">
            <Link
              href="/"
              className={cn("nav-pill-tab", !isDecks && "active")}
            >
              Notes
            </Link>
            <Link
              href="/decks"
              className={cn("nav-pill-tab", isDecks && "active")}
            >
              Flashcards
            </Link>
          </div>

          <Link
            href={newHref}
            className="btn-nav-primary"
            aria-label={isDecks ? "Create new deck" : "Create new note"}
          >
            <span aria-hidden="true" className="sm:hidden">
              +
            </span>
            <span className="hidden sm:inline">{newLabel}</span>
          </Link>

          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
