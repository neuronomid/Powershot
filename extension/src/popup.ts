import {
  POWERSHOT_CAPTURE_REGION,
  POWERSHOT_CAPTURE_VISIBLE,
  PRIMARY_APP_URL,
} from "./constants";
import "./popup.css";

const browserChrome = (globalThis as typeof globalThis & { chrome?: any }).chrome;

function setStatus(message: string) {
  const status = document.querySelector<HTMLParagraphElement>("#status");
  if (status) {
    status.textContent = message;
  }
}

async function sendAction(type: string) {
  if (!browserChrome?.runtime?.sendMessage) {
    setStatus("Chrome extension APIs are unavailable in this context.");
    return;
  }

  setStatus("Sending capture to Powershot...");

  try {
    const response = await browserChrome.runtime.sendMessage({ type });
    if (!response?.ok) {
      throw new Error(response?.error || "Capture failed.");
    }
    setStatus("Capture staged in Powershot.");
    window.close();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Capture failed.");
  }
}

document.querySelector<HTMLButtonElement>("#capture-visible")?.addEventListener(
  "click",
  () => {
    void sendAction(POWERSHOT_CAPTURE_VISIBLE);
  },
);

document.querySelector<HTMLButtonElement>("#capture-region")?.addEventListener(
  "click",
  () => {
    void sendAction(POWERSHOT_CAPTURE_REGION);
  },
);

const openAppLink = document.querySelector<HTMLAnchorElement>("#open-app");
if (openAppLink) {
  openAppLink.href = `${PRIMARY_APP_URL}/new`;
}
