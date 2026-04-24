import Link from "next/link";
import { Heart } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-card/30 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-4 py-8 text-xs font-medium text-muted-foreground sm:flex-row sm:px-6 sm:py-10 sm:text-sm">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          <span className="font-bold tracking-[-0.01em] text-foreground/80">
            Powershot
          </span>
          <span className="opacity-40">/</span>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:gap-8">
          <Link
            href="/new"
            className="tracking-[-0.01em] transition-colors hover:text-primary"
          >
            Create Note
          </Link>
          <Link
            href="/privacy"
            className="tracking-[-0.01em] transition-colors hover:text-primary"
          >
            Privacy Policy
          </Link>
          <Link
            href="/donate"
            className="inline-flex items-center gap-1.5 tracking-[-0.01em] transition-colors hover:text-primary"
          >
            <Heart className="size-3.5" />
            Support
          </Link>
        </nav>
      </div>
    </footer>
  );
}