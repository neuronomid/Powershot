import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(() => new ImageData(1, 1)),
  putImageData: vi.fn(),
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// Polyfill ImageData for jsdom
class ImageDataPolyfill {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace;

  constructor(
    dataOrWidth: Uint8ClampedArray | number,
    widthOrHeight: number,
    heightOrSettings?: number | ImageDataSettings,
    settings?: ImageDataSettings,
  ) {
    let width: number;
    let height: number;
    let data: Uint8ClampedArray;
    let colorSpace: PredefinedColorSpace = "srgb";

    if (typeof dataOrWidth === "number") {
      width = dataOrWidth;
      height = widthOrHeight;
      data = new Uint8ClampedArray(width * height * 4);
      if (heightOrSettings && typeof heightOrSettings === "object") {
        colorSpace = heightOrSettings.colorSpace ?? "srgb";
      }
    } else {
      data = dataOrWidth;
      width = widthOrHeight;
      if (typeof heightOrSettings === "number") {
        height = heightOrSettings;
      } else {
        height = data.length / (width * 4);
      }
      if (settings) {
        colorSpace = settings.colorSpace ?? "srgb";
      } else if (heightOrSettings && typeof heightOrSettings === "object") {
        colorSpace = heightOrSettings.colorSpace ?? "srgb";
      }
    }

    this.data = data;
    this.width = width;
    this.height = height;
    this.colorSpace = colorSpace;
  }
}

globalThis.ImageData = ImageDataPolyfill as unknown as typeof ImageData;
