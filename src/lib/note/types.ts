import type { ChunkAnchor, OrderingWarning } from "@/lib/pipeline/types";
import type { StagedImage } from "@/lib/upload/types";
import type { ExportTheme } from "@/lib/theme/types";

export type Note = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  images: StagedImage[];
  markdown: string;
  extractedMarkdown: string;
  anchors: ChunkAnchor[];
  warnings: OrderingWarning[];
  tokenSubsetViolations: string[] | null;
  preferences: ExportTheme;
};

export type NotePatch = Partial<
  Pick<Note, "title" | "markdown" | "warnings" | "tokenSubsetViolations" | "preferences">
>;
