import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row">
        <p>&copy; {new Date().getFullYear()} Powershot</p>
        <Link href="/privacy" className="hover:text-foreground transition-colors">
          Privacy
        </Link>
      </div>
    </footer>
  );
}
