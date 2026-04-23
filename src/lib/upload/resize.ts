/**
 * Resize and compress an image File to a JPEG data URL.
 * Keeps payload size reasonable for serverless limits (~4.5 MB).
 */
export function resizeImageToDataUrl(
  file: File,
  opts: { maxWidth?: number; maxHeight?: number; quality?: number; maxBytes?: number } = {},
): Promise<string> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.85, maxBytes = 4_000_000 } = opts;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return reject(new Error("Canvas 2D context not available"));
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", quality);

      // Guardrail: ensure we stay well under Vercel's ~4.5 MB body limit.
      const header = "data:image/jpeg;base64,";
      const payloadBytes = Math.ceil((dataUrl.length - header.length) * 0.75);
      if (payloadBytes > maxBytes) {
        return reject(
          new Error(
            `Resized image still too large (${Math.round(payloadBytes / 1_000_000)} MB). Try a smaller screenshot or lower quality.`,
          ),
        );
      }

      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Failed to decode image for resize"));
    img.src = URL.createObjectURL(file);
  });
}
