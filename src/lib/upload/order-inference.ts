import exifr from "exifr";

import { parseFilenameTimestamp } from "./filename-timestamp";
import type { OrderConfidence, StagedImage, TimestampSource } from "./types";

type Detected = {
  at: Date | null;
  source: TimestampSource;
};

async function detectOne(file: File): Promise<Detected> {
  const fromName = parseFilenameTimestamp(file.name);
  if (fromName) return { at: fromName, source: "filename" };

  try {
    const exif = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate"],
    });
    const stamp: Date | undefined = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (stamp instanceof Date && !Number.isNaN(stamp.getTime())) {
      return { at: stamp, source: "exif" };
    }
  } catch {
    // exifr throws on formats it can't parse (e.g. HEIC in some browsers) — fall through.
  }

  if (file.lastModified) {
    return { at: new Date(file.lastModified), source: "lastModified" };
  }
  return { at: null, source: "insertion" };
}

// Stable compare by (detected timestamp, insertion index).
export async function detectAndOrder(
  images: StagedImage[],
): Promise<{ ordered: StagedImage[]; confidence: OrderConfidence }> {
  const withDetected = await Promise.all(
    images.map(async (img, idx) => {
      const d = await detectOne(img.file);
      return { img, detected: d, idx };
    }),
  );

  withDetected.sort((a, b) => {
    const ta = a.detected.at?.getTime() ?? Number.POSITIVE_INFINITY;
    const tb = b.detected.at?.getTime() ?? Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return a.idx - b.idx;
  });

  const ordered: StagedImage[] = withDetected.map(({ img, detected }) => ({
    ...img,
    detectedAt: detected.at,
    timestampSource: detected.source,
  }));

  const confidence = scoreConfidence(withDetected.map((w) => w.detected));
  return { ordered, confidence };
}

function scoreConfidence(detected: Detected[]): OrderConfidence {
  if (detected.length <= 1) return "high";

  const sources = new Set(detected.map((d) => d.source));

  // Any image with no usable timestamp at all → low.
  if (sources.has("insertion")) return "low";

  // Strong signal on any image.
  if (sources.has("filename") || sources.has("exif")) return "high";

  // All lastModified — usable only if they actually spread apart.
  const stamps = detected
    .map((d) => d.at?.getTime())
    .filter((t): t is number => typeof t === "number")
    .sort((a, b) => a - b);
  if (stamps.length < 2) return "low";

  const spreadMs = stamps[stamps.length - 1] - stamps[0];
  // Detect ties: if any two adjacent stamps are within 1s, treat as bunched.
  let bunched = false;
  for (let i = 1; i < stamps.length; i++) {
    if (stamps[i] - stamps[i - 1] < 1000) {
      bunched = true;
      break;
    }
  }

  if (bunched) return "low";
  if (spreadMs < 2000) return "low";
  return "medium";
}
