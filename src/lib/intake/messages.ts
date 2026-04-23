export const POWERSHOT_CAPTURE = "POWERSHOT_CAPTURE";
export const POWERSHOT_CAPTURE_ACK = "POWERSHOT_CAPTURE_ACK";

export type PowershotCaptureSource = "visible-tab" | "region" | "sample";

export type PowershotCaptureImage = {
  dataUrl: string;
  title: string;
  source: PowershotCaptureSource;
};

export type PowershotCaptureMessage = {
  type: typeof POWERSHOT_CAPTURE;
  captureId: string;
  title?: string;
  autoStart?: boolean;
  transient?: boolean;
  images: PowershotCaptureImage[];
};

export type PowershotCaptureAckMessage = {
  type: typeof POWERSHOT_CAPTURE_ACK;
  captureId: string;
  noteId: string;
};

export function isPowershotCaptureMessage(
  value: unknown,
): value is PowershotCaptureMessage {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PowershotCaptureMessage>;
  return (
    candidate.type === POWERSHOT_CAPTURE &&
    typeof candidate.captureId === "string" &&
    Array.isArray(candidate.images) &&
    candidate.images.every(
      (image) =>
        image &&
        typeof image === "object" &&
        typeof image.dataUrl === "string" &&
        typeof image.title === "string" &&
        (image.source === "visible-tab" ||
          image.source === "region" ||
          image.source === "sample"),
    )
  );
}

export function postPowershotCapture(
  message: PowershotCaptureMessage,
  targetOrigin = window.location.origin,
) {
  window.postMessage(message, targetOrigin);
}

export function postPowershotCaptureAck(
  captureId: string,
  noteId: string,
  targetOrigin = window.location.origin,
) {
  const message: PowershotCaptureAckMessage = {
    type: POWERSHOT_CAPTURE_ACK,
    captureId,
    noteId,
  };
  window.postMessage(message, targetOrigin);
}
