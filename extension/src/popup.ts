import {
  POWERSHOT_CAPTURE_REGION,
  POWERSHOT_CAPTURE_VISIBLE,
  POWERSHOT_SEND_BATCH,
  POWERSHOT_TRAY_CLEAR,
  POWERSHOT_TRAY_GET,
  POWERSHOT_TRAY_REMOVE,
  POWERSHOT_TRAY_UPDATED,
  PRIMARY_APP_URL,
} from "./constants";
import { getChromeApi } from "./chrome";
import type { TrayItem, TrayState } from "./tray";
import "./popup.css";

let busy = false;
let lastState: TrayState = { items: [] };

const els = {
  status: document.querySelector<HTMLParagraphElement>("#status"),
  tray: document.querySelector<HTMLDivElement>("#tray"),
  trayCount: document.querySelector<HTMLSpanElement>("#tray-count"),
  trayClear: document.querySelector<HTMLButtonElement>("#tray-clear"),
  send: document.querySelector<HTMLButtonElement>("#send-batch"),
  sendLabel: document.querySelector<HTMLSpanElement>("#send-label"),
  captureVisible: document.querySelector<HTMLButtonElement>("#capture-visible"),
  captureRegion: document.querySelector<HTMLButtonElement>("#capture-region"),
  openApp: document.querySelector<HTMLAnchorElement>("#open-app"),
};

function setStatus(message: string, error = false) {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.classList.toggle("error", error);
}

function setBusy(value: boolean) {
  busy = value;
  if (els.captureVisible) els.captureVisible.disabled = value;
  if (els.captureRegion) els.captureRegion.disabled = value;
  if (els.send) els.send.disabled = value || lastState.items.length === 0;
  if (els.trayClear) els.trayClear.disabled = value;
}

function clearChildren(node: Element) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function renderTray(state: TrayState) {
  lastState = state;
  const tray = els.tray;
  if (!tray) return;

  clearChildren(tray);
  const count = state.items.length;

  if (els.trayCount) {
    els.trayCount.textContent = count === 1 ? "1 capture" : `${count} captures`;
  }
  if (els.trayClear) {
    els.trayClear.hidden = count === 0;
  }
  if (els.send) {
    els.send.disabled = busy || count === 0;
  }
  if (els.sendLabel) {
    els.sendLabel.textContent =
      count <= 1 ? "Send to Powershot" : `Send ${count} to Powershot`;
  }

  if (count === 0) {
    const empty = document.createElement("p");
    empty.className = "tray-empty";
    empty.id = "tray-empty";
    empty.textContent =
      "No captures yet. Use the buttons above or the keyboard shortcuts.";
    tray.appendChild(empty);
    return;
  }

  state.items.forEach((item, index) => {
    tray.appendChild(buildThumb(item, index + 1));
  });
}

function buildThumb(item: TrayItem, index: number) {
  const wrapper = document.createElement("div");
  wrapper.className = "thumb";
  wrapper.title = item.title;

  const img = document.createElement("img");
  img.src = item.dataUrl;
  img.alt = item.title;
  img.loading = "lazy";
  wrapper.appendChild(img);

  const idx = document.createElement("span");
  idx.className = "index";
  idx.textContent = String(index);
  wrapper.appendChild(idx);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "remove";
  remove.setAttribute("aria-label", `Remove capture ${index}`);
  remove.textContent = "×";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    void removeItem(item.id);
  });
  wrapper.appendChild(remove);

  const source = document.createElement("span");
  source.className = "source";
  source.textContent = item.source === "region" ? "Region" : "Visible tab";
  wrapper.appendChild(source);

  return wrapper;
}

async function sendToBackground<TResponse = { ok: boolean; error?: string; state?: TrayState }>(
  message: Record<string, unknown>,
): Promise<TResponse> {
  const browserChrome = getChromeApi();
  if (!browserChrome?.runtime?.sendMessage) {
    throw new Error("Chrome extension APIs are unavailable.");
  }
  return browserChrome.runtime.sendMessage<TResponse>(message);
}

async function refreshTray() {
  try {
    const response = await sendToBackground({ type: POWERSHOT_TRAY_GET });
    if (response?.state) {
      renderTray(response.state);
    }
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not load the tray.",
      true,
    );
  }
}

async function captureAction(type: string, label: string) {
  if (busy) return;
  setBusy(true);
  setStatus(`${label}…`);
  try {
    const response = await sendToBackground({ type });
    if (!response?.ok) {
      throw new Error(response?.error || `${label} failed.`);
    }
    if (response.state) renderTray(response.state);
    setStatus("Added to tray.");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : `${label} failed.`,
      true,
    );
  } finally {
    setBusy(false);
  }
}

async function removeItem(id: string) {
  if (busy) return;
  setBusy(true);
  try {
    const response = await sendToBackground({ type: POWERSHOT_TRAY_REMOVE, id });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not remove the capture.");
    }
    if (response.state) renderTray(response.state);
    setStatus("");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not remove the capture.",
      true,
    );
  } finally {
    setBusy(false);
  }
}

async function clearAll() {
  if (busy) return;
  if (!confirm("Clear every capture from the tray?")) return;
  setBusy(true);
  try {
    const response = await sendToBackground({ type: POWERSHOT_TRAY_CLEAR });
    if (!response?.ok) {
      throw new Error(response?.error || "Could not clear the tray.");
    }
    if (response.state) renderTray(response.state);
    setStatus("Tray cleared.");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Could not clear the tray.",
      true,
    );
  } finally {
    setBusy(false);
  }
}

async function sendBatch() {
  if (busy || lastState.items.length === 0) return;
  setBusy(true);
  setStatus(
    `Sending ${lastState.items.length} capture${
      lastState.items.length === 1 ? "" : "s"
    } to Powershot…`,
  );
  try {
    const response = await sendToBackground({ type: POWERSHOT_SEND_BATCH });
    if (!response?.ok) {
      throw new Error(response?.error || "Send failed.");
    }
    setStatus("Captures handed off to Powershot.");
    window.close();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Send failed.", true);
    setBusy(false);
  }
}

els.captureVisible?.addEventListener("click", () => {
  void captureAction(POWERSHOT_CAPTURE_VISIBLE, "Capturing visible tab");
});

els.captureRegion?.addEventListener("click", () => {
  void captureAction(POWERSHOT_CAPTURE_REGION, "Selecting region");
});

els.send?.addEventListener("click", () => {
  void sendBatch();
});

els.trayClear?.addEventListener("click", () => {
  void clearAll();
});

if (els.openApp) {
  els.openApp.href = `${PRIMARY_APP_URL}/new`;
}

getChromeApi()?.runtime.onMessage.addListener((message: unknown) => {
  if (
    message &&
    typeof message === "object" &&
    (message as { type?: unknown }).type === POWERSHOT_TRAY_UPDATED
  ) {
    const state = (message as { state?: TrayState }).state;
    if (state) renderTray(state);
  }
  return undefined;
});

void refreshTray();
