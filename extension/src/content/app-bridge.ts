// This file is injected as a classic content script — MV3 does not support
// ES module imports in content_scripts entries. Keep this file self-contained:
// use `import type` only (erased at build time) and inline any runtime values.

import type {
  PowershotCaptureAckMessage,
  PowershotCaptureMessage,
} from "../../../src/lib/intake/messages";

const POWERSHOT_CAPTURE = "POWERSHOT_CAPTURE";
const POWERSHOT_CAPTURE_ACK = "POWERSHOT_CAPTURE_ACK";
const POWERSHOT_DELIVER_CAPTURE = "POWERSHOT_DELIVER_CAPTURE";

const ACK_TIMEOUT_MS = 10000;
const REPOST_INTERVAL_MS = 250;

type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: { ok: boolean; error?: string }) => void,
) => boolean | undefined | void;

type ChromeRuntime = {
  runtime?: {
    onMessage?: {
      addListener(listener: RuntimeMessageListener): void;
    };
  };
};

function getChrome(): ChromeRuntime | undefined {
  return (globalThis as typeof globalThis & { chrome?: ChromeRuntime }).chrome;
}

function isCaptureAck(value: unknown): value is PowershotCaptureAckMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PowershotCaptureAckMessage>;
  return (
    candidate.type === POWERSHOT_CAPTURE_ACK &&
    typeof candidate.captureId === "string" &&
    typeof candidate.noteId === "string"
  );
}

function isPowershotCaptureMessage(
  value: unknown,
): value is PowershotCaptureMessage {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PowershotCaptureMessage>;
  if (candidate.type !== POWERSHOT_CAPTURE) return false;
  if (typeof candidate.captureId !== "string") return false;
  if (!Array.isArray(candidate.images)) return false;
  return candidate.images.every((image) => {
    if (!image || typeof image !== "object") return false;
    const entry = image as {
      dataUrl?: unknown;
      title?: unknown;
      source?: unknown;
    };
    return (
      typeof entry.dataUrl === "string" &&
      typeof entry.title === "string" &&
      (entry.source === "visible-tab" ||
        entry.source === "region" ||
        entry.source === "sample")
    );
  });
}

function isDeliverCaptureMessage(value: unknown): value is {
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

console.log("[Powershot] app-bridge content script loaded on", window.location.href);

getChrome()?.runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
  if (!isDeliverCaptureMessage(message)) {
    return undefined;
  }

  console.log("[Powershot] app-bridge received capture payload with", message.payload.images.length, "image(s)");

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
});
