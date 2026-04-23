export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">
        Privacy
      </h1>
      <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          Powershot is designed so your images and notes never touch our disks.
          Screenshots live in memory and in transit only, long enough for the
          extraction pipeline to run.
        </p>
        <p>
          Your finished notes stay in this browser (IndexedDB for notes,
          localStorage for preferences). We write nothing to a server database
          and no image bytes or extracted text appear in our logs.
        </p>
        <p className="text-xs italic">
          Full policy copy lands in Phase 7. This page is a stub.
        </p>
      </div>
    </div>
  );
}
