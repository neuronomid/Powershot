"use client";

import { Plus } from "lucide-react";
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
  const newLabel = isDecks ? "New Deck" : "New Note";
  const newAriaLabel = isDecks ? "Create new deck" : "Create new note";

  return (
    <header
      className={cn(
        "nav-design fixed top-0 left-0 right-0 z-50 w-full",
        scrolled && "scrolled",
      )}
    >
      <div className="mx-auto grid min-h-[var(--site-header-height)] w-full max-w-[1140px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-2.5 sm:gap-y-0 sm:px-[52px] sm:py-0">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-1 transition-opacity hover:opacity-90"
          aria-label="Powershot home"
        >
          <div className="relative block size-11 shrink-0 sm:size-16 dark:hidden">
            <Image
              src="/Logos/Logo5.png"
              alt=""
              fill
              sizes="(min-width: 640px) 64px, 44px"
              priority
              className="object-contain"
            />
          </div>
          <div className="relative hidden size-11 shrink-0 sm:size-16 dark:block">
            <Image
              src="/Logos/Logo5-dark.png"
              alt=""
              fill
              sizes="(min-width: 640px) 64px, 44px"
              priority
              className="object-contain"
            />
          </div>
          <span className="font-heading -ml-3 truncate text-[17px] font-bold tracking-[-0.02em] text-[#1e3560] sm:-ml-5 sm:text-[22px] dark:text-white">
            Powershot
          </span>
        </Link>

        <nav className="col-span-2 row-start-2 flex min-w-0 items-center sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <div className="nav-pill flex w-full min-w-0 items-center sm:w-auto">
            <Link
              href="/"
              className={cn(
                "nav-pill-tab inline-flex min-h-10 flex-1 items-center justify-center text-center sm:min-h-0 sm:flex-none",
                !isDecks && "active",
              )}
            >
              Notes
            </Link>
            <Link
              href="/decks"
              className={cn(
                "nav-pill-tab inline-flex min-h-10 flex-1 items-center justify-center text-center sm:min-h-0 sm:flex-none",
                isDecks && "active",
              )}
            >
              Flashcards
            </Link>
          </div>
        </nav>

        <div className="col-start-2 row-start-1 flex items-center gap-2 justify-self-end sm:col-start-3">
          <Link
            href={newHref}
            className="btn-nav-primary btn-nav-primary-icon"
            aria-label={newAriaLabel}
          >
            <Plus aria-hidden="true" className="size-4 shrink-0" />
            <span className="hidden sm:inline">{newLabel}</span>
          </Link>

          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
