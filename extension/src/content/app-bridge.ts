import {
  POWERSHOT_CAPTURE_ACK,
  isPowershotCaptureMessage,
  type PowershotCaptureAckMessage,
  type PowershotCaptureMessage,
} from "../../../src/lib/intake/messages";
import { getChromeApi } from "../chrome";
import { POWERSHOT_DELIVER_CAPTURE } from "../constants";

const ACK_TIMEOUT_MS = 10000;
const REPOST_INTERVAL_MS = 250;

function isCaptureAck(value: unknown): value is PowershotCaptureAckMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PowershotCaptureAckMessage>;
  return (
    candidate.type === POWERSHOT_CAPTURE_ACK &&
    typeof candidate.captureId === "string" &&
    typeof candidate.noteId === "string"
  );
}

function isDeliverCaptureMessage(
  value: unknown,
): value is {
  type: typeof POWERSHOT_DELIVER_CAPTURE;
  payload: PowershotCaptureMessage;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; payload?: unknown };
  return (
    candidate.type === POWERSHOT_DELIVER_CAPTURE &&
    isPowershotCaptureMessage(candidate.payload)
  );
}

getChromeApi()?.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: unknown,
    sendResponse: (response: { ok: boolean; error?: string }) => void,
  ) => {
    if (!isDeliverCaptureMessage(message)) {
      return undefined;
    }

    const payload = message.payload;
    const captureId = payload.captureId;
    let settled = false;
    let repostHandle: number | null = null;

    const cleanup = () => {
      if (repostHandle !== null) {
        window.clearInterval(repostHandle);
        repostHandle = null;
      }
      window.clearTimeout(timeoutHandle);
      window.removeEventListener("message", onWindowMessage);
    };

    const onWindowMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }
      if (!isCaptureAck(event.data) || event.data.captureId !== captureId) {
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      sendResponse({ ok: true });
    };

    const timeoutHandle = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      sendResponse({
        ok: false,
        error: "Powershot did not acknowledge the capture in time.",
      });
    }, ACK_TIMEOUT_MS);

    window.addEventListener("message", onWindowMessage);

    const post = () => {
      try {
        window.postMessage(payload, window.location.origin);
      } catch {
        // Posting can fail during page transitions; the next interval retries.
      }
    };

    post();
    repostHandle = window.setInterval(() => {
      if (settled) return;
      post();
    }, REPOST_INTERVAL_MS) as unknown as number;

    return true;
  },
);
