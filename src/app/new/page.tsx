"use client";

import { AlertTriangle, ImagePlus, Info, Upload } from "lucide-react";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef, useState } from "react";

import { Filmstrip } from "@/components/upload/filmstrip";
import { UploadSurface } from "@/components/upload/upload-surface";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { detectAndOrder } from "@/lib/upload/order-inference";
import type {
  OrderConfidence,
  RejectedFile,
  StagedImage,
} from "@/lib/upload/types";
import { isAcceptedImage, rejectionReason } from "@/lib/upload/validation";

export default function NewNotePage() {
  const [images, setImages] = useState<StagedImage[]>([]);
  const [autoOrderIds, setAutoOrderIds] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<OrderConfidence>("high");
  const [rejections, setRejections] = useState<RejectedFile[]>([]);
  const imagesRef = useRef<StagedImage[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Revoke object URLs on unmount.
  useEffect(() => {
    return () => {
      for (const img of imagesRef.current) {
        URL.revokeObjectURL(img.objectUrl);
      }
    };
  }, []);

  const handleFilesAdded = useCallback(
    async (
      accepted: File[],
      dropzoneRejections: Array<{ file: File; reason: string }>,
    ) => {
      // Second-pass validation: dropzone may pass HEIC with empty MIME.
      const fresh: StagedImage[] = [];
      const newRejections: RejectedFile[] = dropzoneRejections.map((r) => ({
        name: r.file.name,
        reason: r.reason,
      }));
      for (const file of accepted) {
        if (!isAcceptedImage(file)) {
          newRejections.push({ name: file.name, reason: rejectionReason(file) });
          continue;
        }
        const objectUrl = URL.createObjectURL(file);
        fresh.push({
          id: nanoid(),
          file,
          objectUrl,
          previewUrl: objectUrl,
          detectedAt: null,
          timestampSource: "insertion",
        });
      }

      setRejections(newRejections);
      if (fresh.length === 0) return;

      const combined = [...imagesRef.current, ...fresh];
      const { ordered, confidence } = await detectAndOrder(combined);
      setImages(ordered);
      setAutoOrderIds(ordered.map((i) => i.id));
      setConfidence(confidence);
    },
    [],
  );

  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.objectUrl);
      return prev.filter((i) => i.id !== id);
    });
    setAutoOrderIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const handleReorder = useCallback((next: StagedImage[]) => {
    setImages(next);
  }, []);

  const handleResetOrder = useCallback(() => {
    setImages((prev) => {
      const byId = new Map(prev.map((i) => [i.id, i]));
      return autoOrderIds
        .map((id) => byId.get(id))
        .filter((x): x is StagedImage => Boolean(x));
    });
  }, [autoOrderIds]);

  const hasImages = images.length > 0;
  const isReorderedFromAuto =
    hasImages &&
    (images.length !== autoOrderIds.length ||
      images.some((img, idx) => autoOrderIds[idx] !== img.id));

  return (
    <UploadSurface onFilesAdded={handleFilesAdded}>
      {({ openFilePicker }) => (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
          <header className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">
              New note
            </h1>
            <p className="text-sm text-muted-foreground">
              Drop screenshots anywhere on this page, pick them from disk, or
              paste from your clipboard (⌘V). Order is auto-detected — confirm
              below before generating.
            </p>
          </header>

          {rejections.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertTitle>
                {rejections.length}{" "}
                {rejections.length === 1 ? "file" : "files"} skipped
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-1 space-y-0.5">
                  {rejections.slice(0, 5).map((r, i) => (
                    <li key={i} className="truncate">
                      <span className="font-medium">{r.name}</span> — {r.reason}
                    </li>
                  ))}
                  {rejections.length > 5 && (
                    <li>…and {rejections.length - 5} more</li>
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {!hasImages ? (
            <EmptyState onPick={openFilePicker} />
          ) : (
            <>
              {confidence === "low" && (
                <Alert>
                  <Info />
                  <AlertTitle>We couldn&rsquo;t confidently detect order</AlertTitle>
                  <AlertDescription>
                    Timestamps are missing or tied. Please drag tiles (or use
                    arrow keys) to set the right sequence before generating.
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-medium text-muted-foreground">
                    {images.length}{" "}
                    {images.length === 1 ? "screenshot" : "screenshots"}
                  </h2>
                  {isReorderedFromAuto && (
                    <button
                      type="button"
                      onClick={handleResetOrder}
                      className="text-xs text-primary underline underline-offset-2 hover:text-foreground"
                    >
                      Reset to auto-detected
                    </button>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openFilePicker}
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Add more
                </Button>
              </div>

              <Filmstrip
                images={images}
                onReorder={handleReorder}
                onRemove={handleRemove}
              />
            </>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
            <Button type="button" disabled={!hasImages}>
              Generate
            </Button>
          </div>
        </div>
      )}
    </UploadSurface>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="group flex h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 text-center transition-colors hover:border-primary/60 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Upload className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">Drop screenshots, click to browse, or paste</p>
        <p className="text-xs text-muted-foreground">
          PNG, JPG, WebP, HEIC — uploaded one at a time, never stored on our servers
        </p>
      </div>
    </button>
  );
}
