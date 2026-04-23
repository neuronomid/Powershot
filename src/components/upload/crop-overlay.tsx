"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Scissors, Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CropRegion } from "@/lib/upload/types";

type CropOverlayProps = {
  imageUrl: string;
  initialCrop?: CropRegion | null;
  onApply: (crop: CropRegion | null) => void;
  onCancel: () => void;
};

type DragState =
  | { type: "none" }
  | { type: "draw"; startX: number; startY: number }
  | { type: "move"; offsetX: number; offsetY: number }
  | { type: "resize"; handle: Handle };

type Handle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

const HANDLE_SIZE = 12;
const MIN_CROP_SIZE = 20;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

export function CropOverlay({ imageUrl, initialCrop, onApply, onCancel }: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [crop, setCrop] = useState<CropRegion | null>(initialCrop ?? null);
  const [drag, setDrag] = useState<DragState>({ type: "none" });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  const getRect = useCallback(() => {
    return containerRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const updateImageSize = useCallback(() => {
    const rect = imgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setImgSize({ width: rect.width, height: rect.height });
  }, []);

  const toRatios = useCallback(
    (px: number, py: number, pw: number, ph: number): CropRegion => {
      const w = imgSize.width || 1;
      const h = imgSize.height || 1;
      return {
        x: clamp(px / w, 0, 1),
        y: clamp(py / h, 0, 1),
        width: clamp(pw / w, 0, 1 - px / w),
        height: clamp(ph / h, 0, 1 - py / h),
      };
    },
    [imgSize.width, imgSize.height],
  );

  const fromRatios = useCallback(
    (r: CropRegion) => {
      const w = imgSize.width || 1;
      const h = imgSize.height || 1;
      return {
        x: r.x * w,
        y: r.y * h,
        width: r.width * w,
        height: r.height * h,
      };
    },
    [imgSize.width, imgSize.height],
  );

  const getMousePos = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      const rect = getRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: clamp(e.clientX - rect.left, 0, imgSize.width || rect.width),
        y: clamp(e.clientY - rect.top, 0, imgSize.height || rect.height),
      };
    },
    [getRect, imgSize.width, imgSize.height],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getMousePos(e);
    const rect = getRect();
    if (!rect) return;

    if (crop) {
      const c = fromRatios(crop);
      // Check handles first
      const handle = getHandleAt(pos.x, pos.y, c);
      if (handle) {
        setDrag({ type: "resize", handle });
        return;
      }
      // Check inside crop
      if (
        pos.x >= c.x &&
        pos.x <= c.x + c.width &&
        pos.y >= c.y &&
        pos.y <= c.y + c.height
      ) {
        setDrag({ type: "move", offsetX: pos.x - c.x, offsetY: pos.y - c.y });
        return;
      }
    }

    // Start new draw
    setCrop(null);
    setDrag({ type: "draw", startX: pos.x, startY: pos.y });
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (drag.type === "none") return;
      const pos = getMousePos(e);

      if (drag.type === "draw") {
        const x = Math.min(drag.startX, pos.x);
        const y = Math.min(drag.startY, pos.y);
        const w = Math.abs(pos.x - drag.startX);
        const h = Math.abs(pos.y - drag.startY);
        setCrop(toRatios(x, y, w, h));
        return;
      }

      if (drag.type === "move" && crop) {
        const c = fromRatios(crop);
        let nx = pos.x - drag.offsetX;
        let ny = pos.y - drag.offsetY;
        nx = clamp(nx, 0, rectWidth() - c.width);
        ny = clamp(ny, 0, rectHeight() - c.height);
        setCrop(toRatios(nx, ny, c.width, c.height));
        return;
      }

      if (drag.type === "resize" && crop) {
        const c = fromRatios(crop);
        let { x, y, width, height } = c;

        switch (drag.handle) {
          case "nw":
            width = c.x + c.width - pos.x;
            height = c.y + c.height - pos.y;
            x = pos.x;
            y = pos.y;
            break;
          case "n":
            height = c.y + c.height - pos.y;
            y = pos.y;
            break;
          case "ne":
            width = pos.x - c.x;
            height = c.y + c.height - pos.y;
            y = pos.y;
            break;
          case "e":
            width = pos.x - c.x;
            break;
          case "se":
            width = pos.x - c.x;
            height = pos.y - c.y;
            break;
          case "s":
            height = pos.y - c.y;
            break;
          case "sw":
            width = c.x + c.width - pos.x;
            height = pos.y - c.y;
            x = pos.x;
            break;
          case "w":
            width = c.x + c.width - pos.x;
            x = pos.x;
            break;
        }

        if (width < MIN_CROP_SIZE) width = MIN_CROP_SIZE;
        if (height < MIN_CROP_SIZE) height = MIN_CROP_SIZE;
        x = clamp(x, 0, rectWidth() - width);
        y = clamp(y, 0, rectHeight() - height);

        setCrop(toRatios(x, y, width, height));
      }
    };

    const onUp = () => {
      setDrag({ type: "none" });
    };

    const rectWidth = () => getRect()?.width ?? 0;
    const rectHeight = () => getRect()?.height ?? 0;

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, crop, getRect, getMousePos, toRatios, fromRatios]);

  useEffect(() => {
    updateImageSize();
    window.addEventListener("resize", updateImageSize);
    return () => window.removeEventListener("resize", updateImageSize);
  }, [imageUrl, updateImageSize]);

  // Keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!crop) return;
      const step = e.shiftKey ? 10 : 2;
      const c = fromRatios(crop);
      let { x, y, width, height } = c;

      if (e.key === "Enter") {
        e.preventDefault();
        onApply(crop);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }

      if (e.shiftKey) {
        // Move crop
        if (e.key === "ArrowLeft") x -= step;
        if (e.key === "ArrowRight") x += step;
        if (e.key === "ArrowUp") y -= step;
        if (e.key === "ArrowDown") y += step;
        x = clamp(x, 0, rectWidth() - width);
        y = clamp(y, 0, rectHeight() - height);
      } else {
        // Resize crop
        if (e.key === "ArrowLeft") width -= step;
        if (e.key === "ArrowRight") width += step;
        if (e.key === "ArrowUp") height -= step;
        if (e.key === "ArrowDown") height += step;
        if (width < MIN_CROP_SIZE) width = MIN_CROP_SIZE;
        if (height < MIN_CROP_SIZE) height = MIN_CROP_SIZE;
      }

      e.preventDefault();
      setCrop(toRatios(x, y, width, height));
    };

    const rectWidth = () => getRect()?.width ?? 0;
    const rectHeight = () => getRect()?.height ?? 0;

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [crop, onApply, onCancel, getRect, toRatios, fromRatios]);

  const cropPx = crop ? fromRatios(crop) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Scissors className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Crop image</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Drag to select. Arrow keys resize, Shift+arrow moves, Enter applies, Escape cancels.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setCrop(null)} className="rounded-full text-xs font-semibold">
            <RotateCcw className="mr-1 size-3.5" />
            Reset
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="rounded-full text-xs font-semibold">
            <X className="mr-1 size-3.5" />
            Cancel
          </Button>
          <Button type="button" variant="glossy" size="sm" onClick={() => onApply(crop)} className="rounded-full text-xs font-bold">
            <Check className="mr-1 size-3.5" />
            Apply
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center p-4 sm:p-8">
        <div
          ref={containerRef}
          className="relative inline-block select-none"
          onMouseDown={handleMouseDown}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Crop source"
            className="max-w-full max-h-[70vh] h-auto object-contain"
            draggable={false}
            onLoad={() => requestAnimationFrame(updateImageSize)}
          />

          {/* Overlay */}
          {cropPx && (
            <>
              {/* Dark overlay with cutout */}
              <div
                className="absolute inset-0 bg-black/40"
                style={{
                  clipPath: `polygon(
                    0% 0%,
                    0% 100%,
                    ${cropPx.x}px 100%,
                    ${cropPx.x}px ${cropPx.y}px,
                    ${cropPx.x + cropPx.width}px ${cropPx.y}px,
                    ${cropPx.x + cropPx.width}px ${cropPx.y + cropPx.height}px,
                    ${cropPx.x}px ${cropPx.y + cropPx.height}px,
                    ${cropPx.x}px 100%,
                    100% 100%,
                    100% 0%
                  )`,
                }}
              />
              {/* Crop border */}
              <div
                className="absolute border-2 border-primary shadow-sm"
                style={{
                  left: cropPx.x,
                  top: cropPx.y,
                  width: cropPx.width,
                  height: cropPx.height,
                }}
              />
              {/* Handles */}
              {(
                [
                  { key: "nw", left: cropPx.x, top: cropPx.y },
                  { key: "n", left: cropPx.x + cropPx.width / 2, top: cropPx.y },
                  { key: "ne", left: cropPx.x + cropPx.width, top: cropPx.y },
                  { key: "e", left: cropPx.x + cropPx.width, top: cropPx.y + cropPx.height / 2 },
                  { key: "se", left: cropPx.x + cropPx.width, top: cropPx.y + cropPx.height },
                  { key: "s", left: cropPx.x + cropPx.width / 2, top: cropPx.y + cropPx.height },
                  { key: "sw", left: cropPx.x, top: cropPx.y + cropPx.height },
                  { key: "w", left: cropPx.x, top: cropPx.y + cropPx.height / 2 },
                ] as { key: Handle; left: number; top: number }[]
              ).map((h) => (
                <div
                  key={h.key}
                  className="absolute rounded-full bg-primary border-2 border-white shadow-sm cursor-pointer"
                  style={{
                    left: h.left - HANDLE_SIZE / 2,
                    top: h.top - HANDLE_SIZE / 2,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                  }}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getHandleAt(
  mx: number,
  my: number,
  c: { x: number; y: number; width: number; height: number },
): Handle | null {
  const hs = HANDLE_SIZE + 4; // slightly larger hit area
  const handles: { key: Handle; x: number; y: number }[] = [
    { key: "nw", x: c.x, y: c.y },
    { key: "n", x: c.x + c.width / 2, y: c.y },
    { key: "ne", x: c.x + c.width, y: c.y },
    { key: "e", x: c.x + c.width, y: c.y + c.height / 2 },
    { key: "se", x: c.x + c.width, y: c.y + c.height },
    { key: "s", x: c.x + c.width / 2, y: c.y + c.height },
    { key: "sw", x: c.x, y: c.y + c.height },
    { key: "w", x: c.x, y: c.y + c.height / 2 },
  ];

  for (const h of handles) {
    if (Math.abs(mx - h.x) <= hs && Math.abs(my - h.y) <= hs) {
      return h.key;
    }
  }
  return null;
}
