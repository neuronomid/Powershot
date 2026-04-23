import type { PowershotCaptureMessage } from "../../src/lib/intake/messages";
import { POWERSHOT_CAPTURE } from "../../src/lib/intake/messages";
import {
  buildNewNoteUrl,
  POWERSHOT_CAPTURE_REGION,
  POWERSHOT_CAPTURE_VISIBLE,
  POWERSHOT_DELIVER_CAPTURE,
} from "./constants";

const browserChrome = (globalThis as typeof globalThis & { chrome?: any }).chrome;
const MAX_DELIVERY_ATTEMPTS = 3;
const DELIVERY_BACKOFF_MS = 500;

type RegionSelection = {
  x: number;
  y: number;
  width: number;
  height: number;
  devicePixelRatio: number;
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeCaptureId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `capture-${Date.now()}`;
}

async function getActiveTab() {
  const tabs = await browserChrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  return tabs[0];
}

function buildCapturePayload(
  dataUrl: string,
  title: string,
  source: "visible-tab" | "region",
): PowershotCaptureMessage {
  return {
    type: POWERSHOT_CAPTURE,
    captureId: makeCaptureId(),
    title,
    images: [
      {
        dataUrl,
        title,
        source,
      },
    ],
  };
}

async function captureVisibleTab(windowId?: number) {
  return browserChrome.tabs.captureVisibleTab(windowId, {
    format: "png",
  });
}

async function isTabReady(tabId: number) {
  const [{ result }] = await browserChrome.scripting.executeScript({
    target: { tabId },
    func: () => document.readyState === "complete",
  });

  return Boolean(result);
}

async function deliverCapture(tabId: number, payload: PowershotCaptureMessage) {
  for (let attempt = 0; attempt < MAX_DELIVERY_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await delay(DELIVERY_BACKOFF_MS);
    }

    const ready = await isTabReady(tabId).catch(() => false);
    if (!ready) {
      continue;
    }

    try {
      const response = await browserChrome.tabs.sendMessage(tabId, {
        type: POWERSHOT_DELIVER_CAPTURE,
        payload,
      });

      if (response?.ok) {
        return;
      }
    } catch {
      // The app bridge may not be ready yet; retry.
    }
  }

  throw new Error("Could not hand the capture to Powershot.");
}

async function openPowershotTab() {
  const tab = await browserChrome.tabs.create({
    url: buildNewNoteUrl(),
    active: true,
  });

  if (!tab?.id) {
    throw new Error("Could not open the Powershot tab.");
  }

  return tab.id as number;
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

async function blobToDataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return `data:${blob.type};base64,${btoa(binary)}`;
}

async function cropDataUrl(dataUrl: string, region: RegionSelection) {
  const blob = await dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);
  const scale = region.devicePixelRatio || 1;
  const sx = Math.max(0, Math.round(region.x * scale));
  const sy = Math.max(0, Math.round(region.y * scale));
  const sw = Math.max(1, Math.round(region.width * scale));
  const sh = Math.max(1, Math.round(region.height * scale));
  const canvas = new OffscreenCanvas(sw, sh);
  const context = canvas.getContext("2d");

  if (!context) {
    return dataUrl;
  }

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
  return blobToDataUrl(croppedBlob);
}

async function pickRegion(tabId: number) {
  const [{ result }] = await browserChrome.scripting.executeScript({
    target: { tabId },
    func: () =>
      new Promise<RegionSelection | null>((resolve) => {
        const existing = document.getElementById("powershot-region-overlay");
        if (existing) {
          existing.remove();
        }

        const overlay = document.createElement("div");
        overlay.id = "powershot-region-overlay";
        Object.assign(overlay.style, {
          position: "fixed",
          inset: "0",
          zIndex: "2147483647",
          cursor: "crosshair",
          background: "rgba(17, 24, 39, 0.22)",
        });

        const box = document.createElement("div");
        Object.assign(box.style, {
          position: "absolute",
          border: "2px solid #f59e0b",
          background: "rgba(245, 158, 11, 0.14)",
          display: "none",
          pointerEvents: "none",
        });

        const label = document.createElement("div");
        Object.assign(label.style, {
          position: "fixed",
          top: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 14px",
          borderRadius: "999px",
          background: "rgba(17, 24, 39, 0.88)",
          color: "#f9fafb",
          fontFamily: "system-ui, sans-serif",
          fontSize: "13px",
          fontWeight: "700",
          letterSpacing: "0.04em",
        });
        label.textContent = "Drag to select a region. Press Esc to cancel.";

        overlay.appendChild(box);
        overlay.appendChild(label);
        document.documentElement.appendChild(overlay);

        let startX = 0;
        let startY = 0;
        let dragging = false;

        const cleanup = (value: RegionSelection | null) => {
          document.removeEventListener("keydown", onKeyDown, true);
          overlay.removeEventListener("pointerdown", onPointerDown);
          overlay.removeEventListener("pointermove", onPointerMove);
          overlay.removeEventListener("pointerup", onPointerUp);
          overlay.remove();
          resolve(value);
        };

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            cleanup(null);
          }
        };

        const onPointerDown = (event: PointerEvent) => {
          dragging = true;
          startX = event.clientX;
          startY = event.clientY;
          box.style.display = "block";
          box.style.left = `${startX}px`;
          box.style.top = `${startY}px`;
          box.style.width = "0px";
          box.style.height = "0px";
          event.preventDefault();
        };

        const onPointerMove = (event: PointerEvent) => {
          if (!dragging) return;
          const left = Math.min(startX, event.clientX);
          const top = Math.min(startY, event.clientY);
          const width = Math.abs(event.clientX - startX);
          const height = Math.abs(event.clientY - startY);
          box.style.left = `${left}px`;
          box.style.top = `${top}px`;
          box.style.width = `${width}px`;
          box.style.height = `${height}px`;
        };

        const onPointerUp = (event: PointerEvent) => {
          if (!dragging) {
            cleanup(null);
            return;
          }

          dragging = false;
          const left = Math.min(startX, event.clientX);
          const top = Math.min(startY, event.clientY);
          const width = Math.abs(event.clientX - startX);
          const height = Math.abs(event.clientY - startY);

          if (width < 8 || height < 8) {
            cleanup(null);
            return;
          }

          cleanup({
            x: left,
            y: top,
            width,
            height,
            devicePixelRatio: window.devicePixelRatio || 1,
          });
        };

        document.addEventListener("keydown", onKeyDown, true);
        overlay.addEventListener("pointerdown", onPointerDown);
        overlay.addEventListener("pointermove", onPointerMove);
        overlay.addEventListener("pointerup", onPointerUp);
      }),
  });

  return result as RegionSelection | null;
}

async function sendVisibleTabCapture() {
  const activeTab = await getActiveTab();
  if (!activeTab) {
    throw new Error("No active tab found.");
  }

  const dataUrl = await captureVisibleTab(activeTab.windowId);
  const title = `Visible tab - ${activeTab.title || "capture"}`;
  const payload = buildCapturePayload(dataUrl, title, "visible-tab");
  const powershotTabId = await openPowershotTab();
  await deliverCapture(powershotTabId, payload);
}

async function sendRegionCapture() {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    throw new Error("No active tab found.");
  }

  const region = await pickRegion(activeTab.id as number);
  if (!region) {
    throw new Error("Region capture was cancelled.");
  }

  const fullCapture = await captureVisibleTab(activeTab.windowId);
  const croppedDataUrl = await cropDataUrl(fullCapture, region);
  const title = `Region capture - ${activeTab.title || "capture"}`;
  const payload = buildCapturePayload(croppedDataUrl, title, "region");
  const powershotTabId = await openPowershotTab();
  await deliverCapture(powershotTabId, payload);
}

async function handleRuntimeMessage(message: { type?: string }) {
  if (message.type === POWERSHOT_CAPTURE_VISIBLE) {
    await sendVisibleTabCapture();
    return { ok: true };
  }

  if (message.type === POWERSHOT_CAPTURE_REGION) {
    await sendRegionCapture();
    return { ok: true };
  }

  return undefined;
}

browserChrome?.runtime?.onMessage?.addListener?.(
  (
    message: { type?: string },
    _sender: unknown,
    sendResponse: (response: { ok: boolean; error?: string }) => void,
  ) => {
    void handleRuntimeMessage(message)
      .then((response) => {
        if (response) {
          sendResponse(response);
        }
      })
      .catch((error) => {
        sendResponse({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Powershot capture failed.",
        });
      });

    return true;
  },
);

browserChrome?.commands?.onCommand?.addListener?.((command: string) => {
  if (command !== "capture-visible-tab") {
    return;
  }

  void sendVisibleTabCapture().catch(() => {
    // Shortcut failures surface through the lack of handoff in the web app.
  });
});
