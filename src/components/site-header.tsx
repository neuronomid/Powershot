import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="font-heading text-base font-semibold tracking-tight"
        >
          Powershot
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/new"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            New note
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
