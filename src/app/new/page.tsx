import { Button } from "@/components/ui/button";

export default function NewNotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          New note
        </h1>
        <p className="text-sm text-muted-foreground">
          Title your note and drop in screenshots. Order is auto-detected —
          you&rsquo;ll confirm before generating.
        </p>
      </div>

      <div className="flex h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-center">
        <p className="text-sm font-medium">Upload surface lands in Phase 1</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag-drop, file picker, and Cmd+V paste.
        </p>
      </div>

      <div className="flex items-center justify-end">
        <Button disabled>Generate</Button>
      </div>
    </div>
  );
}
