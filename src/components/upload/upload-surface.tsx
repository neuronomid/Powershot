"use client";

import { Upload } from "lucide-react";
import { useEffect } from "react";
import { useDropzone } from "react-dropzone";

import { ACCEPT_ATTR } from "@/lib/upload/validation";
import { cn } from "@/lib/utils";

type UploadSurfaceProps = {
  onFilesAdded: (files: File[], rejections: Array<{ file: File; reason: string }>) => void;
  children: (api: { openFilePicker: () => void; isDragActive: boolean }) => React.ReactNode;
};

// Page-level dropzone + paste handler. Drag anywhere, paste anywhere.
// noClick so the file picker only opens when the child UI explicitly calls openFilePicker().
export function UploadSurface({ onFilesAdded, children }: UploadSurfaceProps) {
  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: ACCEPT_ATTR,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted, rejected) => {
      const rejections = rejected.map((r) => ({
        file: r.file,
        reason: r.errors[0]?.message ?? "Rejected",
      }));
      onFilesAdded(accepted, rejections);
    },
  });

  useEffect(() => {
    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const images: File[] = [];
      for (const item of items) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (!file.type.startsWith("image/")) continue;
        // Browsers hand pasted images a generic name like "image.png". Replace with a timestamp.
        const ext = file.type.split("/")[1] ?? "png";
        const stamped = new File(
          [file],
          `Pasted ${timestampedName()}.${ext}`,
          { type: file.type, lastModified: Date.now() },
        );
        images.push(stamped);
      }
      if (images.length > 0) {
        e.preventDefault();
        onFilesAdded(images, []);
      }
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [onFilesAdded]);

  return (
    <div {...getRootProps({ className: "relative flex-1" })}>
      <input {...getInputProps()} />
      {children({ openFilePicker: open, isDragActive })}
      {isDragActive && (
        <div
          className={cn(
            "pointer-events-none fixed inset-0 z-[100] flex items-center justify-center",
            "bg-background/40 backdrop-blur-md animate-in fade-in duration-300",
          )}
        >
          <div className="rounded-3xl border-2 border-dashed border-primary bg-background/80 px-12 py-10 text-center shadow-2xl ring-1 ring-border/50 animate-in zoom-in-95 duration-300">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Upload className="size-8" />
            </div>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              Drop screenshots to add
            </p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              PNG, JPG, WebP, or HEIC
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function timestampedName(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}.${d
      .getMilliseconds()
      .toString()
      .padStart(3, "0")}`
  );
}
