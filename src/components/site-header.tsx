import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
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
        <nav className="flex items-center gap-4 sm:gap-6">
          <Button
            asChild
            size="sm"
            variant="glossy"
            className="h-9 rounded-full px-4 font-semibold shadow-md shadow-primary/15 ring-1 ring-primary/20 hover:shadow-primary/25 max-[360px]:px-3"
          >
            <Link href="/new">
              <span aria-hidden="true" className="hidden max-[360px]:inline">
                +
              </span>
              <span className="max-[360px]:sr-only">+ New Note</span>
            </Link>
          </Button>
          <div className="h-4 w-px bg-border/60" />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
