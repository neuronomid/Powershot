import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, FileText, History, Plus } from "lucide-react";

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      {/* Background glow effects */}
      <div
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-primary to-[#4f46e5] opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 sm:pb-32 lg:px-8 lg:pt-40 text-center">
        <div className="mx-auto max-w-2xl lg:max-w-4xl">
          <div className="mt-24 sm:mt-32 lg:mt-16 flex justify-center">
            <a href="#" className="inline-flex space-x-6">
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold leading-6 text-primary ring-1 ring-inset ring-primary/20 transition-all hover:bg-primary/20">
                What&apos;s new
              </span>
              <span className="inline-flex items-center space-x-2 text-sm font-medium leading-6 text-muted-foreground transition-colors hover:text-foreground">
                <span>Just shipped v1.0</span>
                <ArrowRight className="size-4" />
              </span>
            </a>
          </div>

          {/* Theme-aware Hero Logo */}
          <div className="relative mt-12 flex justify-center animate-in fade-in zoom-in duration-700">
            <div className="relative h-40 w-40 sm:h-56 sm:w-56">
              <Image
                src="/Logos/Logo5-dark.png"
                alt="Powershot"
                fill
                className="hidden object-contain dark:block"
                priority
              />
              <Image
                src="/Logos/Logo5.png"
                alt="Powershot"
                fill
                className="block object-contain dark:hidden"
                priority
              />
            </div>
          </div>

          <h1 className="mt-10 font-heading text-5xl font-bold tracking-tight text-foreground sm:text-7xl lg:text-8xl animate-in slide-in-from-bottom-4 duration-1000 fill-mode-both">
            From screenshots to <br />
            <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              structured notes.
            </span>
          </h1>
          <p className="mx-auto mt-8 text-pretty text-lg font-medium text-muted-foreground sm:text-xl/8 max-w-2xl animate-in slide-in-from-bottom-8 duration-1000 fill-mode-both delay-200">
            Drop in a stack of screenshots. Powershot extracts the text,
            preserves visual hierarchy, and hands back a polished PDF and DOCX —
            exactly as seen, never rephrased.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6 animate-in slide-in-from-bottom-12 duration-1000 fill-mode-both delay-300">
            <Button
              asChild
              size="lg"
              variant="glossy"
              className="h-12 rounded-full px-10 text-base font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-105 hover:shadow-primary/30"
            >
              <Link href="/new">
                <Plus className="mr-2 size-5" />
                New note
              </Link>
            </Button>
            <Link
              href="/privacy"
              className="text-sm font-semibold leading-6 text-foreground hover:text-primary transition-colors"
            >
              Privacy policy <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Dashboard Section */}
      <div className="mx-auto max-w-7xl px-6 pb-24 sm:pb-32 lg:px-8">
        <div className="mx-auto max-w-2xl lg:mx-0">
          <h2 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            <History className="size-8 text-primary" />
            Recent notes
          </h2>
          <p className="mt-4 text-lg text-muted-foreground font-medium">
            Access your previously generated notes. Everything stays local to
            your browser.
          </p>
        </div>
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-x-8 gap-y-12 border-t border-border/60 pt-10 sm:mt-16 sm:pt-16 lg:mx-0 lg:max-w-none lg:grid-cols-3 animate-in slide-in-from-bottom-20 duration-1000 fill-mode-both delay-500">
          <Card className="group relative overflow-hidden transition-all hover:shadow-xl hover:shadow-primary/5 ring-1 ring-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <div className="rounded-full bg-muted p-4 transition-colors group-hover:bg-primary/10">
                  <FileText className="size-8 text-muted-foreground transition-colors group-hover:text-primary" />
                </div>
                <div>
                  <p className="text-base font-semibold text-foreground">
                    No notes yet
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your generated notes will appear here.
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  className="mt-4 rounded-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all"
                >
                  <Link href="/new">Create your first note</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div
        className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]"
        aria-hidden="true"
      >
        <div
          className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-primary to-[#4f46e5] opacity-10 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
          style={{
            clipPath:
              "polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)",
          }}
        />
      </div>
    </div>
  );
}
