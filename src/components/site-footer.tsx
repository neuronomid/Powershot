import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/40 bg-card/30 backdrop-blur-sm mt-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 text-xs font-medium text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground/80">Powershot</span>
          <span className="opacity-40">/</span>
          <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
        </div>
        <nav className="flex items-center gap-8">
          <Link
            href="/new"
            className="hover:text-primary transition-colors tracking-tight"
          >
            Create Note
          </Link>
          <Link
            href="/donate"
            className="hover:text-primary transition-colors tracking-tight"
          >
            Donate
          </Link>
          <Link
            href="/privacy"
            className="hover:text-primary transition-colors tracking-tight"
          >
            Privacy Policy
          </Link>
        </nav>
      </div>
    </footer>
  );
}
