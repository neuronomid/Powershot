export type TimestampSource =
  | "filename"
  | "exif"
  | "lastModified"
  | "insertion";

export type StagedImage = {
  id: string;
  file: File;
  objectUrl: string;
  previewUrl: string | null; // null when decode failed (e.g. unsupported HEIC)
  detectedAt: Date | null;
  timestampSource: TimestampSource;
};

// High:   at least one strong signal (filename regex or EXIF) disambiguated order.
// Medium: lastModified spread > ~2s across images (usable but weaker).
// Low:    fell back to insertion order or timestamps are tied/bunched.
export type OrderConfidence = "high" | "medium" | "low";

export type RejectedFile = {
  name: string;
  reason: string;
};
