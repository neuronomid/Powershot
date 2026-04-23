"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 sm:px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 shadow-inner">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Something went wrong
        </h1>
        <p className="text-muted-foreground font-medium leading-relaxed">
          An unexpected error occurred. Please try again or return to the home
          page.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => reset()}
          className="rounded-full font-bold"
        >
          <RotateCcw className="mr-2 size-4" />
          Try again
        </Button>
        <Button asChild className="rounded-full font-bold shadow-lg">
          <Link href="/">
            <Home className="mr-2 size-4" />
            Back to home
          </Link>
        </Button>
      </div>
    </div>
  );
}
