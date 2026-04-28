"use client";

import {
  MAX_FLASHCARD_GENERATION_INSTRUCTIONS,
} from "@/lib/flashcard/types";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  value: string;
  onChange: (next: string) => void;
  label?: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
};

export function InstructionPromptField({
  id,
  value,
  onChange,
  label = "Instruction prompt",
  description = 'Optional. Tell the flashcard generator what to avoid or emphasize. Example: "Do not make flashcards out of pronunciations from the note."',
  placeholder = "Add an optional instruction for the flashcard generator...",
  rows = 4,
  className,
}: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          {label}
        </label>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {value.length}/{MAX_FLASHCARD_GENERATION_INSTRUCTIONS}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {description}
      </p>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value.slice(0, MAX_FLASHCARD_GENERATION_INSTRUCTIONS),
          )
        }
        maxLength={MAX_FLASHCARD_GENERATION_INSTRUCTIONS}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border/60 bg-background px-4 py-3 text-sm font-medium leading-relaxed text-foreground shadow-sm placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}
