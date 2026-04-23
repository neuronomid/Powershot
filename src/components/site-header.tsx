import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full bg-transparent border-none shadow-none transition-colors duration-300">
      <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6 border-none">
        <Link
          href="/"
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <div className="relative size-8 overflow-hidden rounded-lg shadow-sm ring-1 ring-border/20">
            <Image
              src="/Logos/Logo5.png"
              alt="Powershot Logo"
              fill
              className="object-cover dark:hidden"
              priority
            />
            <Image
              src="/Logos/Logo5-dark.png"
              alt="Powershot Logo"
              fill
              className="hidden object-cover dark:block"
              priority
            />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-foreground/90">
            Powershot
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/new"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            New note
          </Link>
          <div className="h-4 w-px bg-border/60" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
