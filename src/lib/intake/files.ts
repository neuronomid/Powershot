import type { PowershotCaptureMessage } from "./messages";

function extensionForType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

function sanitizeBaseName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return cleaned || "capture";
}

export async function dataUrlToFile(
  dataUrl: string,
  name: string,
  lastModified = Date.now(),
): Promise<File> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const extension = extensionForType(blob.type);
  const fileName = name.includes(".") ? name : `${sanitizeBaseName(name)}.${extension}`;

  return new File([blob], fileName, {
    type: blob.type || "image/png",
    lastModified,
  });
}

export async function captureMessageToFiles(
  message: PowershotCaptureMessage,
): Promise<File[]> {
  return Promise.all(
    message.images.map((image, index) =>
      dataUrlToFile(
        image.dataUrl,
        image.title,
        Date.now() + index,
      ),
    ),
  );
}
