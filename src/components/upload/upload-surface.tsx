"use client";

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
            "pointer-events-none fixed inset-0 z-50 flex items-center justify-center",
            "bg-background/80 backdrop-blur-sm",
          )}
        >
          <div className="rounded-2xl border-2 border-dashed border-primary bg-background/60 px-10 py-8 text-center shadow-lg">
            <p className="text-lg font-semibold">Drop screenshots to add</p>
            <p className="mt-1 text-sm text-muted-foreground">
              PNG, JPG, WebP, HEIC
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
