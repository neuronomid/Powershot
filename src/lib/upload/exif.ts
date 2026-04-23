import * as exifr from "exifr";

/**
 * Read EXIF orientation from a File/Blob and return the orientation value.
 * Returns undefined if no orientation tag is present.
 */
export async function readExifOrientation(file: File): Promise<number | undefined> {
  try {
    const orientation = await exifr.orientation(file);
    return orientation ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Apply EXIF auto-rotation to a canvas context before drawing an image.
 * Call this before ctx.drawImage().
 *
 * @param ctx - Canvas 2D context
 * @param orientation - EXIF orientation value (1-8)
 * @param width - Source image width
 * @param height - Source image height
 * @returns The actual width and height of the rotated canvas
 */
export function applyExifTransform(
  ctx: CanvasRenderingContext2D,
  orientation: number,
  width: number,
  height: number,
): { width: number; height: number } {
  switch (orientation) {
    case 2:
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      return { width, height };
    case 3:
      ctx.translate(width, height);
      ctx.rotate(Math.PI);
      return { width, height };
    case 4:
      ctx.translate(0, height);
      ctx.scale(1, -1);
      return { width, height };
    case 5:
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(-1, 1);
      return { width: height, height: width };
    case 6:
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      return { width: height, height: width };
    case 7:
      ctx.translate(height, 0);
      ctx.rotate(Math.PI / 2);
      ctx.scale(1, -1);
      return { width: height, height: width };
    case 8:
      ctx.translate(0, width);
      ctx.rotate(-Math.PI / 2);
      return { width: height, height: width };
    case 1:
    default:
      return { width, height };
  }
}
