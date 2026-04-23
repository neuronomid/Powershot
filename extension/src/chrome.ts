export type ChromeMessageResponse = {
  ok: boolean;
  error?: string;
};

export type ChromeTab = {
  id?: number;
  windowId?: number;
  title?: string;
};

type RuntimeMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: ChromeMessageResponse) => void,
) => boolean | undefined | void;

export type ChromeApi = {
  tabs: {
    query(queryInfo: {
      active: boolean;
      currentWindow: boolean;
    }): Promise<ChromeTab[]>;
    captureVisibleTab(
      windowId?: number,
      options?: { format: "png" },
    ): Promise<string>;
    create(createProperties: {
      url: string;
      active: boolean;
    }): Promise<ChromeTab>;
    sendMessage<TResponse = ChromeMessageResponse | undefined>(
      tabId: number,
      message: unknown,
    ): Promise<TResponse>;
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
