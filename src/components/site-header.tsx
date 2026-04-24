"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const isDecks = pathname?.startsWith("/decks") ?? false;

  return (
    <header className="sticky top-0 z-50 w-full border-none bg-background/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 sm:h-20 w-full max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 border-none">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-2 sm:gap-2.5 transition-opacity hover:opacity-90"
        >
          <div className="relative size-8 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-border/20">
            <Image
              src="/Logos/Logo5.png"
              alt="Powershot Logo"
              fill
              sizes="32px"
              className="object-cover dark:hidden"
              priority
            />
            <Image
              src="/Logos/Logo5-dark.png"
              alt="Powershot Logo"
              fill
              sizes="32px"
              className="hidden object-cover dark:block"
              priority
            />
          </div>
          <span className="hidden font-heading text-lg font-bold tracking-tight text-foreground/90 min-[380px]:inline">
            Powershot
          </span>
        </Link>

        <nav className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <div className="hidden rounded-full border border-border/60 bg-card/60 p-1 shadow-sm sm:inline-flex">
            <Link
              href="/"
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
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
                "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
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
            className="h-9 rounded-full px-3 font-semibold shadow-md shadow-primary/15 ring-1 ring-primary/20 hover:shadow-primary/25 sm:px-4"
          >
            <Link
              href={isDecks ? "/decks/new" : "/new"}
              aria-label={isDecks ? "Create new deck" : "Create new note"}
            >
              <span aria-hidden="true" className="sm:hidden">
                +
              </span>
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
