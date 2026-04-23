"use client";

import { useEffect, useState } from "react";
import { Timer } from "lucide-react";

export type DebugTiming = {
  label: string;
  ms: number;
};

export function useDebugPanel() {
  const [entries, setEntries] = useState<DebugTiming[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "d" && e.ctrlKey && e.shiftKey) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const log = (label: string, ms: number) => {
    setEntries((prev) => [...prev, { label, ms }]);
  };
  const clear = () => setEntries([]);

  return { open, setOpen, entries, log, clear };
}

export function DebugPanel({
  entries,
  onClear,
}: {
  entries: DebugTiming[];
  onClear: () => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-xs rounded-xl border border-border bg-card/95 p-4 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Timer className="size-3.5" />
          Debug timings
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-bold uppercase tracking-wider text-primary hover:underline"
        >
          Clear
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {entries.map((e, i) => (
          <li key={i} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{e.label}</span>
            <span className="font-mono font-medium text-foreground">
              {e.ms.toLocaleString()} ms
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
