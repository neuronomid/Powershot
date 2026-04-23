export type ExtractionStatus =
  | "queued"
  | "extracting"
  | "reviewing"
  | "done"
  | "failed";

export type PipelineStage =
  | "idle"
  | "extracting"
  | "deduping"
  | "reviewing"
  | "completed"
  | "failed";

export type ChunkAnchor = {
  imageId: string;
  startOffset: number;
  endOffset: number;
};

export type OrderingWarning = {
  afterChunk: number;
  beforeChunk: number;
  reason: string;
};

export type ExtractionJob = {
  imageId: string;
  fileName: string;
  status: ExtractionStatus;
  markdown: string;
  model: string | null;
  error: string | null;
  anchor: ChunkAnchor;
};

export type PipelineResult = {
  markdown: string;
  warnings: OrderingWarning[];
  tokenSubsetViolations: string[] | null;
  anchors: ChunkAnchor[];
  preReviewMarkdown?: string;
};

export type PipelineTiming = {
  extractionMs: number;
  dedupMs: number;
  reviewMs: number;
  totalMs: number;
};

export type PipelineState = {
  stage: PipelineStage;
  jobs: ExtractionJob[];
  result: PipelineResult | null;
  error: string | null;
  timing: PipelineTiming | null;
};

export type BatchProgress = {
  percent: number;
  label: string;
  etaSeconds: number | null;
};

export type RemovedPassage = {
  text: string;
  tag: "dedup" | "reorder" | "other";
};

export type ReorderedBlock = {
  heading: string;
  fromPosition: number;
  toPosition: number;
};

export type ReviewChangeSummary = {
  removed: RemovedPassage[];
  reordered: ReorderedBlock[];
  hasChanges: boolean;
};

export type ChunkMeta = {
  imageId?: string;
  imageIndex: number;
  model: string;
  croppedRegion?: { x: number; y: number; width: number; height: number } | null;
  enhanced?: boolean;
  source?: "screenshot" | "pdf-page";
};
