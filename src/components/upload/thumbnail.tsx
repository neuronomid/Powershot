"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type ThumbnailProps = {
  src: string;
  alt: string;
  className?: string;
};

// Top ~120px canvas crop of the source screenshot. On decode failure (e.g. HEIC
// where the browser can't render natively), we render a neutral placeholder.
export function Thumbnail({ src, alt, className }: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, canvas.width / img.naturalWidth);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Paint the top of the image; anything past 120 * devicePixelRatio is cropped.
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, drawW, drawH);
      setStatus("ready");
    };
    img.onerror = () => {
      if (!cancelled) setStatus("error");
    };
    img.src = src;
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return (
    <div
      className={cn(
        "relative h-[120px] w-full overflow-hidden rounded-lg bg-muted",
        className,
      )}
      aria-label={alt}
    >
      <canvas
        ref={canvasRef}
        // Fixed backing-store size; visual size stretches via CSS.
        width={600}
        height={120}
        className={cn(
          "block h-full w-full object-cover",
          status === "ready" ? "opacity-100" : "opacity-0",
        )}
      />
      {status !== "ready" && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {status === "error" ? "Preview unavailable" : "Loading…"}
        </div>
      )}
    </div>
  );
}
