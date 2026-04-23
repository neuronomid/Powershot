"use client";

import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";
import { useRef, useState } from "react";

import { Thumbnail } from "@/components/upload/thumbnail";
import { Button } from "@/components/ui/button";
import type { StagedImage, TimestampSource } from "@/lib/upload/types";
import { cn } from "@/lib/utils";

type FilmstripProps = {
  images: StagedImage[];
  onReorder: (next: StagedImage[]) => void;
  onRemove: (id: string) => void;
};

export function Filmstrip({ images, onReorder, onRemove }: FilmstripProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const liveRef = useRef<HTMLDivElement>(null);

  const moveImage = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) {
      return;
    }
    onReorder(arrayMove(images, from, to));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.id === active.id);
    const to = images.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    moveImage(from, to);
  };

  return (
    <>
      <div ref={liveRef} aria-live="polite" aria-atomic="true" className="sr-only">
        {activeId
          ? `Dragging ${images.find((i) => i.id === activeId)?.file.name ?? "image"}`
          : ""}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={images.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
          <ol
            className="grid grid-cols-[repeat(auto-fill,minmax(105px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2 sm:gap-3 md:gap-4"
            role="list"
            aria-label="Screenshot order. Use arrow keys or drag to reorder."
          >
            {images.map((img, idx) => (
              <FilmstripItem
                key={img.id}
                image={img}
                index={idx}
                imageCount={images.length}
                onMove={moveImage}
                onRemove={() => onRemove(img.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </>
  );
}

type FilmstripItemProps = {
  image: StagedImage;
  index: number;
  imageCount: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
};

function FilmstripItem({
  image,
  index,
  imageCount,
  onMove,
  onRemove,
}: FilmstripItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
    transition: {
      duration: 250,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
  });

  const dragHandleRef = useRef<HTMLButtonElement>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const previous = event.key === "ArrowLeft" || event.key === "ArrowUp";
    const next = event.key === "ArrowRight" || event.key === "ArrowDown";
    if (!previous && !next) return;

    event.preventDefault();
    const target = previous ? Math.max(0, index - 1) : Math.min(imageCount - 1, index + 1);
    onMove(index, target);
    // Return focus to the moved item after the state update flushes.
    requestAnimationFrame(() => {
      dragHandleRef.current?.focus();
    });
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-2 sm:p-3",
        "focus-within:ring-2 focus-within:ring-ring",
        isDragging && "z-10 opacity-90 shadow-2xl scale-[1.02] ring-2 ring-primary/30",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          #{index + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          onClick={onRemove}
          aria-label={`Remove ${image.file.name}`}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="relative group/thumb overflow-hidden rounded-xl bg-muted ring-1 ring-border/40 transition-all group-hover:ring-primary/30">
        {image.previewUrl ? (
          <Thumbnail src={image.previewUrl} alt={image.file.name} />
        ) : (
          <div className="flex h-[120px] w-full items-center justify-center text-xs text-muted-foreground font-medium">
            Preview unavailable
          </div>
        )}
        <div className="absolute inset-0 bg-primary/5 opacity-0 transition-opacity group-hover/thumb:opacity-100" />
      </div>

      <button
        ref={dragHandleRef}
        type="button"
        {...attributes}
        {...listeners}
        onKeyDown={handleKeyDown}
        className={cn(
          "cursor-grab rounded-lg p-1 text-left transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:cursor-grabbing",
        )}
        aria-label={`Reorder ${image.file.name}. Use arrow keys to move this screenshot.`}
      >
        <span
          className="block truncate text-[11px] font-bold tracking-tight text-foreground/90"
          title={image.file.name}
        >
          {image.file.name}
        </span>
        <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground/80">
          {formatDetected(image)}
        </span>
      </button>
    </li>
  );
}

function formatDetected(img: StagedImage): string {
  if (!img.detectedAt) return "No timestamp";
  const d = img.detectedAt;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
  return `${stamp} via ${labelFor(img.timestampSource)}`;
}

function labelFor(source: TimestampSource): string {
  switch (source) {
    case "filename":
      return "filename";
    case "exif":
      return "EXIF";
    case "lastModified":
      return "file modified";
    case "insertion":
      return "added order";
  }
}
