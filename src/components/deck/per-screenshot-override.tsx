"use client";

import { useMemo, useState } from "react";
import { Settings2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfigPanel } from "./config-panel";
import type {
  DeckPreferences,
  PerImageOverride,
} from "@/lib/flashcard/types";
import type { StagedImage } from "@/lib/upload/types";

type Props = {
  image: StagedImage | null;
  globalPreferences: DeckPreferences;
  existingOverride?: PerImageOverride;
  onClose: () => void;
  onSave: (override: PerImageOverride | null) => void;
};

export function PerScreenshotOverrideDialog({
  image,
  globalPreferences,
  existingOverride,
  onClose,
  onSave,
}: Props) {
  const initial: DeckPreferences = useMemo(() => {
    if (!existingOverride) return { ...globalPreferences };
    return {
      styles: existingOverride.styles ?? globalPreferences.styles,
      difficulty: existingOverride.difficulty ?? globalPreferences.difficulty,
      styleAutoPick: globalPreferences.styleAutoPick,
      generationInstructions: globalPreferences.generationInstructions,
    };
  }, [existingOverride, globalPreferences]);

  const [prefs, setPrefs] = useState<DeckPreferences>(initial);

  if (!image) return null;

  function handleSave() {
    if (!image) return;
    const sameAsGlobal =
      prefs.difficulty === globalPreferences.difficulty &&
      JSON.stringify(prefs.styles) === JSON.stringify(globalPreferences.styles);

    if (sameAsGlobal) {
      onSave(null);
    } else {
      onSave({
        imageId: image.id,
        styles: prefs.styles,
        difficulty: prefs.difficulty,
      });
    }
    onClose();
  }

  function handleReset() {
    if (!image) return;
    setPrefs(globalPreferences);
    onSave(null);
    onClose();
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" />
            Override for this screenshot
          </DialogTitle>
          <DialogDescription className="text-xs">
            {image.file.name}. Changes here only affect this screenshot. Reset
            to use the global defaults.
          </DialogDescription>
        </DialogHeader>
        <ConfigPanel
          preferences={prefs}
          onChange={setPrefs}
          compact
          showGenerationInstructions={false}
        />
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="rounded-full"
          >
            <X className="mr-2 size-3.5" />
            Use global defaults
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="glossy"
              size="sm"
              onClick={handleSave}
              className="rounded-full"
            >
              Save override
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
