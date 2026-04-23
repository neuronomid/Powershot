import Link from "next/link";
import { Heart } from "lucide-react";

import { DonateBox } from "@/components/donate/donate-box";

export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <div id="donate" className="scroll-mt-24 mx-auto w-full max-w-7xl px-6 py-16">
        <div className="mx-auto max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/10 via-pink-500/10 to-orange-400/10 ring-1 ring-rose-500/20">
              <Heart className="size-5 text-rose-500 fill-rose-500" />
            </div>
            <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              Support Powershot
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Found Powershot useful? Coffee is always welcome ☕
            </p>
          </div>
          <DonateBox compact />
        </div>
      </div>

      <div className="border-t border-border/40 bg-card/30 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-6 px-6 py-10 text-xs font-medium text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground/80">Powershot</span>
            <span className="opacity-40">/</span>
            <p>&copy; {new Date().getFullYear()} All rights reserved.</p>
          </div>
          <nav className="flex items-center gap-8">
            <Link
              href="/#donate"
              className="hover:text-primary transition-colors tracking-tight"
            >
              Donate
            </Link>
            <Link
              href="/new"
              className="hover:text-primary transition-colors tracking-tight"
            >
              Create Note
            </Link>
            <Link
              href="/privacy"
              className="hover:text-primary transition-colors tracking-tight"
            >
              Privacy Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
