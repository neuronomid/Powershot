import type { ChunkAnchor, OrderingWarning, ChunkMeta } from "@/lib/pipeline/types";
import type { StagedImage } from "@/lib/upload/types";
import type { ExportTheme } from "@/lib/theme/types";

export type Note = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  transient: boolean;
  images: StagedImage[];
  markdown: string;
  extractedMarkdown: string;
  anchors: ChunkAnchor[];
  warnings: OrderingWarning[];
  tokenSubsetViolations: string[] | null;
  preferences: ExportTheme;
  chunks: ChunkMeta[];
};

export type NotePatch = Partial<
  Pick<Note, "title" | "markdown" | "extractedMarkdown" | "anchors" | "warnings" | "tokenSubsetViolations" | "preferences" | "chunks">
>;
