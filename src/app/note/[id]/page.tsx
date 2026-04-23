type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NotePage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
      <div className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Note
        </span>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {id}
        </h1>
      </div>
      <div className="grid min-h-[60vh] grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Source images (Phase 4)
        </div>
        <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/20 p-6 text-sm text-muted-foreground">
          Editable Markdown (Phase 4)
        </div>
      </div>
    </div>
  );
}
