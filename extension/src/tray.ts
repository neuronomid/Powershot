import type { ChromeApi } from "./chrome";
import { requireChromeApi } from "./chrome";

export const TRAY_STORAGE_KEY = "powershot_tray";
export const TRAY_MAX_ITEMS = 30;

export type TraySource = "visible-tab" | "region";

export type TrayItem = {
  id: string;
  dataUrl: string;
  title: string;
  source: TraySource;
  capturedAt: number;
  width: number;
  height: number;
};

export type TrayState = {
  items: TrayItem[];
};

function emptyState(): TrayState {
  return { items: [] };
}

function getStorage(api?: ChromeApi) {
  const browserChrome = api ?? requireChromeApi();
  if (!browserChrome.storage?.local) {
    throw new Error("chrome.storage.local is unavailable.");
  }
  return browserChrome.storage.local;
}

export async function readTray(api?: ChromeApi): Promise<TrayState> {
  const storage = getStorage(api);
  const result = await storage.get(TRAY_STORAGE_KEY);
  const value = result?.[TRAY_STORAGE_KEY];
  if (!value || typeof value !== "object" || !Array.isArray((value as TrayState).items)) {
    return emptyState();
  }
  return value as TrayState;
}

export async function writeTray(state: TrayState, api?: ChromeApi): Promise<void> {
  const storage = getStorage(api);
  await storage.set({ [TRAY_STORAGE_KEY]: state });
}

export async function appendItem(item: TrayItem, api?: ChromeApi): Promise<TrayState> {
  const state = await readTray(api);
  const next: TrayState = {
    items: [...state.items, item].slice(-TRAY_MAX_ITEMS),
  };
  await writeTray(next, api);
  await updateBadge(next.items.length, api);
  return next;
}

export async function removeItem(id: string, api?: ChromeApi): Promise<TrayState> {
  const state = await readTray(api);
  const next: TrayState = {
    items: state.items.filter((item) => item.id !== id),
  };
  await writeTray(next, api);
  await updateBadge(next.items.length, api);
  return next;
}

export async function clearTray(api?: ChromeApi): Promise<TrayState> {
  const next = emptyState();
  await writeTray(next, api);
  await updateBadge(0, api);
  return next;
}

export async function updateBadge(count: number, api?: ChromeApi): Promise<void> {
  const browserChrome = api ?? requireChromeApi();
  const action = browserChrome.action;
  if (!action?.setBadgeText) return;
  try {
    await action.setBadgeText({ text: count > 0 ? String(count) : "" });
    if (action.setBadgeBackgroundColor) {
      await action.setBadgeBackgroundColor({ color: "#b45f2a" });
    }
  } catch {
    // Badge updates are cosmetic; ignore failures.
  }
}

export function makeTrayId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `tray-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
