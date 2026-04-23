import Link from "next/link";
import { FileText, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-xl flex-col items-center justify-center gap-6 px-4 sm:px-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted shadow-inner">
        <FileText className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          Page not found
        </h1>
        <p className="text-muted-foreground font-medium leading-relaxed">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <Button asChild className="rounded-full font-bold shadow-lg">
        <Link href="/">
          <Home className="mr-2 size-4" />
          Back to home
        </Link>
      </Button>
    </div>
  );
}
