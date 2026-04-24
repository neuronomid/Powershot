import type { PowershotCaptureMessage } from "./messages";

const IMAGE_FILE_EXTENSION_RE = /\.(png|jpe?g|webp|gif|heic|heif|svg)$/i;

function decodeDataUrl(dataUrl: string): { bytes: Uint8Array; type: string } {
  const commaIndex = dataUrl.indexOf(",");
  if (!dataUrl.startsWith("data:") || commaIndex === -1) {
    throw new Error("Incoming capture is not a valid data URL.");
  }

  const metadata = dataUrl.slice(5, commaIndex);
  const body = dataUrl.slice(commaIndex + 1);
  const parts = metadata.split(";").filter(Boolean);
  const type = parts[0] && !parts[0].includes("=") ? parts[0] : "image/png";
  const isBase64 = parts.includes("base64");

  if (!isBase64) {
    return {
      bytes: new TextEncoder().encode(decodeURIComponent(body)),
      type,
    };
  }

  let binary: string;
  try {
    binary = atob(body.replace(/\s/g, ""));
  } catch {
    throw new Error("Incoming capture contains invalid base64 image data.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { bytes, type };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

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
  const { bytes, type } = decodeDataUrl(dataUrl);
  const blob = new Blob([toArrayBuffer(bytes)], { type });
  const extension = extensionForType(type);
  const fileName = IMAGE_FILE_EXTENSION_RE.test(name)
    ? name
    : `${sanitizeBaseName(name)}.${extension}`;

  return new File([blob], fileName, {
    type,
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
