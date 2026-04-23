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

  const sourceUrl = image.objectUrl;

  const img = await loadImage(sourceUrl);
  const orientation = await readExifOrientation(image.file);

  // Determine canvas dimensions after rotation
  const isRotated90 = orientation === 5 || orientation === 6 || orientation === 7 || orientation === 8;
  const srcWidth = isRotated90 ? img.naturalHeight : img.naturalWidth;
  const srcHeight = isRotated90 ? img.naturalWidth : img.naturalHeight;

  // Apply crop ratios if present
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

  // Resize after crop
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

  // Apply EXIF rotation transform to the context
  // We draw from the original image into the output canvas.
  // The transform handles rotation; we also need to map crop coordinates back
  // to the original image coordinate system.
  let drawSx = 0;
  let drawSy = 0;
  let drawSw = img.naturalWidth;
  let drawSh = img.naturalHeight;

  if (image.croppedRegion) {
    // croppedRegion ratios are relative to the *rotated* logical dimensions.
    // We need to map them back to the original image coordinates before applying
    // the canvas transform.
    const logicalW = isRotated90 ? img.naturalHeight : img.naturalWidth;
    const logicalH = isRotated90 ? img.naturalWidth : img.naturalHeight;

    const lx = image.croppedRegion.x * logicalW;
    const ly = image.croppedRegion.y * logicalH;
    const lw = image.croppedRegion.width * logicalW;
    const lh = image.croppedRegion.height * logicalH;

    switch (orientation) {
      case 1:
      default:
        drawSx = lx;
        drawSy = ly;
        drawSw = lw;
        drawSh = lh;
        break;
      case 2:
        drawSx = img.naturalWidth - lx - lw;
        drawSy = ly;
        drawSw = lw;
        drawSh = lh;
        break;
      case 3:
        drawSx = img.naturalWidth - lx - lw;
        drawSy = img.naturalHeight - ly - lh;
        drawSw = lw;
        drawSh = lh;
        break;
      case 4:
        drawSx = lx;
        drawSy = img.naturalHeight - ly - lh;
        drawSw = lw;
        drawSh = lh;
        break;
      case 5:
        drawSx = ly;
        drawSy = lx;
        drawSw = lh;
        drawSh = lw;
        break;
      case 6:
        drawSx = img.naturalHeight - ly - lh;
        drawSy = lx;
        drawSw = lh;
        drawSh = lw;
        break;
      case 7:
        drawSx = img.naturalHeight - ly - lh;
        drawSy = img.naturalWidth - lx - lw;
        drawSw = lh;
        drawSh = lw;
        break;
      case 8:
        drawSx = ly;
        drawSy = img.naturalWidth - lx - lw;
        drawSw = lh;
        drawSh = lw;
        break;
    }
  }

  // Clamp draw source to image bounds
  drawSx = Math.max(0, Math.min(drawSx, img.naturalWidth));
  drawSy = Math.max(0, Math.min(drawSy, img.naturalHeight));
  drawSw = Math.max(1, Math.min(drawSw, img.naturalWidth - drawSx));
  drawSh = Math.max(1, Math.min(drawSh, img.naturalHeight - drawSy));

  // Set transform for rotation
  if (orientation) {
    applyExifTransform(ctx, orientation, img.naturalWidth, img.naturalHeight);
  }

  // Draw the (optionally cropped) source region into the output canvas
  ctx.drawImage(
    img,
    drawSx,
    drawSy,
    drawSw,
    drawSh,
    0,
    0,
    outW,
    outH,
  );

  // Enhancement
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
