import {
  POWERSHOT_CAPTURE_ACK,
  type PowershotCaptureAckMessage,
  type PowershotCaptureMessage,
} from "../../../src/lib/intake/messages";
import { POWERSHOT_DELIVER_CAPTURE } from "../constants";

const browserChrome = (globalThis as typeof globalThis & { chrome?: any }).chrome;

function isCaptureAck(value: unknown): value is PowershotCaptureAckMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PowershotCaptureAckMessage>;
  return (
    candidate.type === POWERSHOT_CAPTURE_ACK &&
    typeof candidate.captureId === "string" &&
    typeof candidate.noteId === "string"
  );
}

browserChrome?.runtime?.onMessage?.addListener?.(
  (
    message: { type?: string; payload?: PowershotCaptureMessage },
    _sender: unknown,
    sendResponse: (response: { ok: boolean; error?: string }) => void,
  ) => {
    if (message.type !== POWERSHOT_DELIVER_CAPTURE || !message.payload) {
      return undefined;
    }

    const captureId = message.payload.captureId;

    const timeoutId = window.setTimeout(() => {
      window.removeEventListener("message", onWindowMessage);
      sendResponse({ ok: false, error: "Powershot did not acknowledge the capture in time." });
    }, 2000);

    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      if (!isCaptureAck(event.data) || event.data.captureId !== captureId) {
        return;
      }

      window.clearTimeout(timeoutId);
      window.removeEventListener("message", onWindowMessage);
      sendResponse({ ok: true });
    };

    window.addEventListener("message", onWindowMessage);
    window.postMessage(message.payload, window.location.origin);

    return true;
  },
);
