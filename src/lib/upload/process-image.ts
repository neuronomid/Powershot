/**
 * End-to-end image preparation for VLM extraction.
 * Combines: EXIF auto-rotation, resize, optional crop, optional enhancement.
 */

import type { StagedImage } from "./types";
import { readExifOrientation, applyExifTransform } from "./exif";
import { enhanceImage } from "./enhance";

export type ProcessImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxBytes?: number;
  enhance?: boolean;
};

/**
 * Prepare a StagedImage for extraction:
 * 1. Decode image
 * 2. Apply EXIF auto-rotation (always-on)
 * 3. Apply crop if StagedImage.croppedRegion is set
 * 4. Resize to max dimension
 * 5. Apply enhancement if requested or if StagedImage.enhanced is true
 * 6. Encode as JPEG data URL
 */
export async function processImageForExtraction(
  image: StagedImage,
  opts: ProcessImageOptions = {},
): Promise<string> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.85,
    maxBytes = 4_000_000,
    enhance = false,
  } = opts;

  const img = await loadImage(image.objectUrl);
  const orientation = await readExifOrientation(image.file);
  const orientedCanvas = renderOrientedImage(img, orientation);

  const srcWidth = orientedCanvas.width;
  const srcHeight = orientedCanvas.height;

  let cropX = 0;
  let cropY = 0;
  let cropW = srcWidth;
  let cropH = srcHeight;

  if (image.croppedRegion) {
    cropX = Math.round(image.croppedRegion.x * srcWidth);
    cropY = Math.round(image.croppedRegion.y * srcHeight);
    cropW = Math.round(image.croppedRegion.width * srcWidth);
    cropH = Math.round(image.croppedRegion.height * srcHeight);

    // Clamp
    cropX = Math.max(0, Math.min(cropX, srcWidth));
    cropY = Math.max(0, Math.min(cropY, srcHeight));
    cropW = Math.max(1, Math.min(cropW, srcWidth - cropX));
    cropH = Math.max(1, Math.min(cropH, srcHeight - cropY));
  }

  let outW = cropW;
  let outH = cropH;
  if (outW > maxWidth || outH > maxHeight) {
    const scale = Math.min(maxWidth / outW, maxHeight / outH);
    outW = Math.round(outW * scale);
    outH = Math.round(outH * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  ctx.drawImage(
    orientedCanvas,
    cropX,
    cropY,
    cropW,
    cropH,
    0,
    0,
    outW,
    outH,
  );

  const shouldEnhance = enhance || image.enhanced;
  if (shouldEnhance) {
    const imageData = ctx.getImageData(0, 0, outW, outH);
    enhanceImage(imageData);
    ctx.putImageData(imageData, 0, 0);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", quality);

  // Guardrail
  const header = "data:image/jpeg;base64,";
  const payloadBytes = Math.ceil((dataUrl.length - header.length) * 0.75);
  if (payloadBytes > maxBytes) {
    throw new Error(
      `Resized image still too large (${Math.round(payloadBytes / 1_000_000)} MB). Try a smaller screenshot or lower quality.`,
    );
  }

  return dataUrl;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });
}

function renderOrientedImage(
  img: HTMLImageElement,
  orientation: number | undefined,
): HTMLCanvasElement {
  const isRotated90 =
    orientation === 5 ||
    orientation === 6 ||
    orientation === 7 ||
    orientation === 8;
  const width = isRotated90 ? img.naturalHeight : img.naturalWidth;
  const height = isRotated90 ? img.naturalWidth : img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  if (orientation) {
    applyExifTransform(ctx, orientation, img.naturalWidth, img.naturalHeight);
  }
  ctx.drawImage(img, 0, 0);

  return canvas;
}
