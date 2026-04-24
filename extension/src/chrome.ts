export type ChromeMessageResponse = {
  ok: boolean;
  error?: string;
};

export type ChromeTab = {
  id?: number;
  windowId?: number;
  title?: string;
  url?: string;
};

type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: ChromeMessageResponse) => void,
) => boolean | undefined | void;

type StorageChange = {
  oldValue?: unknown;
  newValue?: unknown;
};

type StorageChangeListener = (
  changes: Record<string, StorageChange>,
  areaName: string,
) => void;

export type ChromeApi = {
  tabs: {
    query(queryInfo: {
      active?: boolean;
      currentWindow?: boolean;
      url?: string | string[];
    }): Promise<ChromeTab[]>;
    captureVisibleTab(
      windowId?: number,
      options?: { format: "png" },
    ): Promise<string>;
    create(createProperties: {
      url: string;
      active: boolean;
    }): Promise<ChromeTab>;
    update(
      tabId: number,
      updateProperties: { active?: boolean; url?: string },
    ): Promise<ChromeTab>;
    sendMessage<TResponse = ChromeMessageResponse | undefined>(
      tabId: number,
      message: unknown,
    ): Promise<TResponse>;
  };
  windows?: {
    update(
      windowId: number,
      updateInfo: { focused: boolean },
    ): Promise<unknown>;
  };
  scripting: {
    executeScript<TResult>(details: {
      target: { tabId: number };
      func: () => TResult | Promise<TResult>;
    }): Promise<Array<{ result: Awaited<TResult> }>>;
  };
  runtime: {
    sendMessage<TResponse = ChromeMessageResponse>(
      message: unknown,
    ): Promise<TResponse>;
    onMessage: {
      addListener(listener: RuntimeMessageListener): void;
    };
    getURL(path: string): string;
  };
  storage?: {
    local: {
      get(keys?: string | string[] | null): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
      clear(): Promise<void>;
    };
    onChanged?: {
      addListener(listener: StorageChangeListener): void;
      removeListener(listener: StorageChangeListener): void;
    };
  };
  action?: {
    setBadgeText(details: { text: string; tabId?: number }): Promise<void>;
    setBadgeBackgroundColor?(details: {
      color: string;
      tabId?: number;
    }): Promise<void>;
  };
  commands?: {
    onCommand?: {
      addListener(listener: (command: string) => void): void;
    };
  };
};

export function getChromeApi(): ChromeApi | undefined {
  return (globalThis as typeof globalThis & { chrome?: ChromeApi }).chrome;
}

export function requireChromeApi(): ChromeApi {
  const chrome = getChromeApi();
  if (!chrome) {
    throw new Error("Chrome extension APIs are unavailable in this context.");
  }

  return chrome;
}
