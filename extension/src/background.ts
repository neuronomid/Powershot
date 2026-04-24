import type { PowershotCaptureMessage } from "../../src/lib/intake/messages";
import { POWERSHOT_CAPTURE } from "../../src/lib/intake/messages";
import {
  buildNewNoteUrl,
  PRIMARY_APP_URL,
  POWERSHOT_CAPTURE_REGION,
  POWERSHOT_CAPTURE_VISIBLE,
  POWERSHOT_DELIVER_CAPTURE,
  POWERSHOT_SEND_BATCH,
  POWERSHOT_TRAY_CLEAR,
  POWERSHOT_TRAY_GET,
  POWERSHOT_TRAY_REMOVE,
  POWERSHOT_TRAY_UPDATED,
} from "./constants";
import { getChromeApi, requireChromeApi } from "./chrome";
import {
  appendItem,
  clearTray,
  makeTrayId,
  readTray,
  removeItem,
  type TrayItem,
  type TrayState,
} from "./tray";

const DELIVERY_TIMEOUT_MS = 12000;
const DELIVERY_POLL_MS = 400;

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

async function getActiveTab() {
  const browserChrome = requireChromeApi();
  const tabs = await browserChrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tabs[0];
}

async function captureVisibleTab(windowId?: number) {
  const browserChrome = requireChromeApi();
  return browserChrome.tabs.captureVisibleTab(windowId, { format: "png" });
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

async function decodeDataUrl(dataUrl: string) {
  const blob = await dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);
  return { blob, bitmap };
}

async function cropDataUrl(dataUrl: string, region: RegionSelection) {
  const { bitmap } = await decodeDataUrl(dataUrl);
  const scale = region.devicePixelRatio || 1;
  const sx = Math.max(0, Math.round(region.x * scale));
  const sy = Math.max(0, Math.round(region.y * scale));
  const sw = Math.max(1, Math.round(region.width * scale));
  const sh = Math.max(1, Math.round(region.height * scale));
  const canvas = new OffscreenCanvas(sw, sh);
  const context = canvas.getContext("2d");
  if (!context) {
    return { dataUrl, width: bitmap.width, height: bitmap.height };
  }
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  const cropped = await canvas.convertToBlob({ type: "image/png" });
  return {
    dataUrl: await blobToDataUrl(cropped),
    width: sw,
    height: sh,
  };
}

async function pickRegion(tabId: number) {
  const browserChrome = requireChromeApi();
  const [{ result }] = await browserChrome.scripting.executeScript({
    target: { tabId },
    func: () =>
      new Promise<RegionSelection | null>((resolve) => {
        const existing = document.getElementById("powershot-region-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.id = "powershot-region-overlay";
        overlay.tabIndex = -1;
        Object.assign(overlay.style, {
          position: "fixed",
          inset: "0",
          zIndex: "2147483647",
          cursor: "crosshair",
          background: "rgba(17, 24, 39, 0.22)",
          outline: "none",
        });

        const previouslyFocused = document.activeElement as HTMLElement | null;

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
        try {
          (previouslyFocused as HTMLElement | null)?.blur?.();
        } catch {
          // ignore blur failures on elements that don't support it
        }
        try {
          overlay.focus({ preventScroll: true });
        } catch {
          overlay.focus();
        }

        let startX = 0;
        let startY = 0;
        let dragging = false;

        const cleanup = (value: RegionSelection | null) => {
          window.removeEventListener("keydown", onKeyDown, true);
          document.removeEventListener("keydown", onKeyDown, true);
          overlay.removeEventListener("keydown", onKeyDown, true);
          overlay.removeEventListener("pointerdown", onPointerDown);
          overlay.removeEventListener("pointermove", onPointerMove);
          overlay.removeEventListener("pointerup", onPointerUp);
          overlay.remove();
          resolve(value);
        };

        const onKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
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

        window.addEventListener("keydown", onKeyDown, true);
        document.addEventListener("keydown", onKeyDown, true);
        overlay.addEventListener("keydown", onKeyDown, true);
        overlay.addEventListener("pointerdown", onPointerDown);
        overlay.addEventListener("pointermove", onPointerMove);
        overlay.addEventListener("pointerup", onPointerUp);
      }),
  });

  return result as RegionSelection | null;
}

function broadcastTray(state: TrayState) {
  const browserChrome = getChromeApi();
  if (!browserChrome?.runtime?.sendMessage) return;
  void browserChrome.runtime
    .sendMessage({ type: POWERSHOT_TRAY_UPDATED, state })
    .catch(() => {
      // No listeners (popup closed) — fine.
    });
}

async function captureVisibleToTray() {
  const activeTab = await getActiveTab();
  if (!activeTab) {
    throw new Error("No active tab found.");
  }

  const dataUrl = await captureVisibleTab(activeTab.windowId);
  const { bitmap } = await decodeDataUrl(dataUrl);
  const item: TrayItem = {
    id: makeTrayId(),
    dataUrl,
    title: `Visible tab — ${activeTab.title || "capture"}`,
    source: "visible-tab",
    capturedAt: Date.now(),
    width: bitmap.width,
    height: bitmap.height,
  };
  const state = await appendItem(item);
  broadcastTray(state);
  return state;
}

async function captureRegionToTray() {
  const activeTab = await getActiveTab();
  if (!activeTab?.id) {
    throw new Error("No active tab found.");
  }

  const region = await pickRegion(activeTab.id);
  if (!region) {
    throw new Error("Region capture was cancelled.");
  }

  const fullCapture = await captureVisibleTab(activeTab.windowId);
  const cropped = await cropDataUrl(fullCapture, region);

  const item: TrayItem = {
    id: makeTrayId(),
    dataUrl: cropped.dataUrl,
    title: `Region — ${activeTab.title || "capture"}`,
    source: "region",
    capturedAt: Date.now(),
    width: cropped.width,
    height: cropped.height,
  };
  const state = await appendItem(item);
  broadcastTray(state);
  return state;
}

function buildBatchPayload(items: TrayItem[]): PowershotCaptureMessage {
  return {
    type: POWERSHOT_CAPTURE,
    captureId: makeTrayId(),
    title:
      items.length === 1
        ? items[0].title
        : `Powershot tray — ${items.length} captures`,
    images: items.map((item) => ({
      dataUrl: item.dataUrl,
      title: item.title,
      source: item.source,
    })),
  };
}

async function findExistingPowershotTab() {
  const browserChrome = requireChromeApi();
  try {
    const tabs = await browserChrome.tabs.query({
      url: [
        `${PRIMARY_APP_URL}/new*`,
        "https://*.powershot.org/new*",
        "http://localhost:3000/new*",
      ],
    });
    return tabs[0];
  } catch {
    return undefined;
  }
}

async function openOrFocusPowershotTab(): Promise<{
  tabId: number;
  windowId?: number;
  created: boolean;
}> {
  const browserChrome = requireChromeApi();
  const existing = await findExistingPowershotTab();
  if (existing?.id) {
    return { tabId: existing.id, windowId: existing.windowId, created: false };
  }

  // Open inactive so the popup keeps focus until delivery completes and the
  // user can see any errors. Activation happens after a successful handoff.
  const tab = await browserChrome.tabs.create({
    url: buildNewNoteUrl(),
    active: false,
  });
  if (!tab?.id) {
    throw new Error("Could not open the Powershot tab.");
  }
  return { tabId: tab.id, windowId: tab.windowId, created: true };
}

async function activatePowershotTab(tabId: number, windowId?: number) {
  const browserChrome = requireChromeApi();
  try {
    await browserChrome.tabs.update(tabId, { active: true });
  } catch {
    // Tab may have been closed by the user; ignore.
  }
  if (windowId !== undefined && browserChrome.windows?.update) {
    await browserChrome.windows
      .update(windowId, { focused: true })
      .catch(() => undefined);
  }
}

async function deliverBatch(tabId: number, payload: PowershotCaptureMessage) {
  const browserChrome = requireChromeApi();
  const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
  let lastError: unknown = null;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts += 1;
    try {
      const response = await browserChrome.tabs.sendMessage(tabId, {
        type: POWERSHOT_DELIVER_CAPTURE,
        payload,
      });
      if (response?.ok) {
        console.log("[Powershot] delivery succeeded after", attempts, "attempt(s)");
        return;
      }
      lastError = new Error(response?.error || "Powershot bridge declined the capture.");
      console.log("[Powershot] delivery attempt", attempts, "declined:", response);
    } catch (error) {
      lastError = error;
      console.log(
        "[Powershot] delivery attempt",
        attempts,
        "failed:",
        error instanceof Error ? error.message : error,
      );
    }
    await delay(DELIVERY_POLL_MS);
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not hand the capture batch to Powershot.");
}

async function sendBatch() {
  const state = await readTray();
  if (state.items.length === 0) {
    throw new Error("Tray is empty — capture at least one screenshot first.");
  }

  const payload = buildBatchPayload(state.items);
  const target = await openOrFocusPowershotTab();
  console.log(
    "[Powershot] delivering",
    payload.images.length,
    "capture(s) to tab",
    target.tabId,
    target.created ? "(newly opened)" : "(existing)",
  );
  try {
    await deliverBatch(target.tabId, payload);
  } catch (error) {
    // Delivery failed — surface the tab so the user sees the app and can retry
    // manually, and let the error propagate to the popup.
    await activatePowershotTab(target.tabId, target.windowId);
    throw error;
  }
  await activatePowershotTab(target.tabId, target.windowId);
  const cleared = await clearTray();
  broadcastTray(cleared);
}

async function handleRuntimeMessage(message: unknown) {
  const type =
    typeof message === "object" && message
      ? (message as { type?: unknown }).type
      : undefined;

  if (type === POWERSHOT_CAPTURE_VISIBLE) {
    const state = await captureVisibleToTray();
    return { ok: true, state };
  }

  if (type === POWERSHOT_CAPTURE_REGION) {
    const state = await captureRegionToTray();
    return { ok: true, state };
  }

  if (type === POWERSHOT_SEND_BATCH) {
    await sendBatch();
    return { ok: true };
  }

  if (type === POWERSHOT_TRAY_GET) {
    const state = await readTray();
    return { ok: true, state };
  }

  if (type === POWERSHOT_TRAY_REMOVE) {
    const id = (message as { id?: string }).id;
    if (!id) {
      throw new Error("Missing tray item id.");
    }
    const state = await removeItem(id);
    broadcastTray(state);
    return { ok: true, state };
  }

  if (type === POWERSHOT_TRAY_CLEAR) {
    const state = await clearTray();
    broadcastTray(state);
    return { ok: true, state };
  }

  return undefined;
}

getChromeApi()?.runtime.onMessage.addListener(
  (
    message: unknown,
    _sender: unknown,
    sendResponse: (response: { ok: boolean; error?: string; state?: TrayState }) => void,
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
            error instanceof Error ? error.message : "Powershot capture failed.",
        });
      });

    return true;
  },
);

getChromeApi()?.commands?.onCommand?.addListener((command: string) => {
  if (command === "capture-visible-tab") {
    void captureVisibleToTray().catch(() => undefined);
    return;
  }
  if (command === "capture-region") {
    void captureRegionToTray().catch(() => undefined);
  }
});

void readTray()
  .then((state) => broadcastTray(state))
  .catch(() => undefined);
