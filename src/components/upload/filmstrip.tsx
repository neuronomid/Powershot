"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X } from "lucide-react";

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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = images.findIndex((i) => i.id === active.id);
    const to = images.findIndex((i) => i.id === over.id);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(images, from, to));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={images.map((i) => i.id)} strategy={horizontalListSortingStrategy}>
        <ol className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4" role="list">
          {images.map((img, idx) => (
            <FilmstripItem
              key={img.id}
              image={img}
              index={idx}
              onRemove={() => onRemove(img.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

type FilmstripItemProps = {
  image: StagedImage;
  index: number;
  onRemove: () => void;
};

function FilmstripItem({ image, index, onRemove }: FilmstripItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative flex flex-col gap-2 rounded-xl border border-border bg-card p-3",
        "focus-within:ring-2 focus-within:ring-ring",
        isDragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-muted-foreground hover:text-foreground"
          onClick={onRemove}
          aria-label={`Remove ${image.file.name}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {image.previewUrl ? (
        <Thumbnail src={image.previewUrl} alt={image.file.name} />
      ) : (
        <div className="flex h-[120px] w-full items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
          Preview unavailable
        </div>
      )}

      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          "cursor-grab rounded-md text-left text-xs leading-tight",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "active:cursor-grabbing",
        )}
        aria-label={`Reorder ${image.file.name}. Press space to pick up, arrow keys to move, space to drop.`}
      >
        <span className="block truncate font-medium text-foreground" title={image.file.name}>
          {image.file.name}
        </span>
        <span className="block truncate text-muted-foreground">
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
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${stamp} · ${labelFor(img.timestampSource)}`;
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
