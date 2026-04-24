import type { CropRegion } from "@/lib/upload/types";
import type { DeckMediaBlob } from "./types";
import * as db from "./db";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Fallback simple hash — not cryptographic. Only used when WebCrypto is unavailable.
    let h = 5381;
    for (let i = 0; i < bytes.length; i++) h = ((h * 33) ^ bytes[i]!) >>> 0;
    return h.toString(16).padStart(8, "0");
  }
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest("SHA-1", ab);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  }
  const buf = new Uint8Array(await blob.arrayBuffer());
  return `data:${blob.type || "application/octet-stream"};base64,${bytesToBase64(buf)}`;
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}

export async function storeMediaFromCrop(params: {
  deckId: string;
  sourceImageUrl: string;
  crop?: CropRegion;
  filenameHint?: string;
}): Promise<string> {
  const { deckId, sourceImageUrl, crop, filenameHint } = params;
  const img = await loadImageFromUrl(sourceImageUrl);
  const naturalW = img.naturalWidth;
  const naturalH = img.naturalHeight;

  const region = crop ?? { x: 0, y: 0, width: naturalW, height: naturalH };
  const sx = Math.max(0, Math.min(naturalW, Math.round(region.x)));
  const sy = Math.max(0, Math.min(naturalH, Math.round(region.y)));
  const sw = Math.max(1, Math.min(naturalW - sx, Math.round(region.width)));
  const sh = Math.max(1, Math.min(naturalH - sy, Math.round(region.height)));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error("Canvas toBlob returned null"));
    }, "image/jpeg", 0.9);
  });

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const hash = await sha1Hex(bytes);
  const id = `${deckId}_${hash}.jpg`;

  const existing = await db.getMedia(id);
  if (existing) return id;

  const media: DeckMediaBlob = {
    id,
    deckId,
    mimeType: "image/jpeg",
    dataBase64: bytesToBase64(bytes),
    filenameHint,
    createdAt: Date.now(),
    crop: region,
  };
  await db.putMedia(media);
  return id;
}

export async function readMediaAsDataUrl(id: string): Promise<string | null> {
  const media = await db.getMedia(id);
  if (!media) return null;
  return `data:${media.mimeType};base64,${media.dataBase64}`;
}

export async function listDeckMedia(deckId: string): Promise<DeckMediaBlob[]> {
  return db.listMediaForDeck(deckId);
}

export async function mediaBlobToDataUrl(media: DeckMediaBlob): Promise<string> {
  return `data:${media.mimeType};base64,${media.dataBase64}`;
}

// Re-export for tests / callers that already have an object URL from the batch
// pipeline and just want to pass a Blob through.
export { blobToDataUrl };
