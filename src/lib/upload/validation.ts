const ACCEPTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const ACCEPTED_EXT = /\.(png|jpe?g|webp|heic|heif|pdf)$/i;

export const ACCEPT_ATTR = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
  "application/pdf": [".pdf"],
} as const;

export function isAcceptedImage(file: File): boolean {
  if (file.type && ACCEPTED_MIME.has(file.type.toLowerCase())) return true;
  // Some browsers give empty MIME for HEIC — fall back to extension sniff.
  return ACCEPTED_EXT.test(file.name);
}

export const MAX_IMAGES_PER_NOTE = 30;

export function rejectionReason(file: File): string {
  return `Unsupported file type: ${file.type || file.name.split(".").pop() || "unknown"}`;
}

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}
