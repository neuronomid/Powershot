import { describe, expect, it } from "vitest";

import { contrastStretch, unsharpMask, enhanceImage } from "./enhance";

describe("image enhancement", () => {
  it("contrastStretch stretches pixel values to full range", () => {
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,
      200, 200, 200, 255,
    ]);
    const imageData = new ImageData(data, 2, 1);
    contrastStretch(imageData);

    expect(imageData.data[0]).toBe(0);
    expect(imageData.data[1]).toBe(0);
    expect(imageData.data[2]).toBe(0);
    expect(imageData.data[4]).toBe(255);
    expect(imageData.data[5]).toBe(255);
    expect(imageData.data[6]).toBe(255);
  });

  it("unsharpMask increases edge contrast", () => {
    // 3x3 image: dark border, bright center
    const data = new Uint8ClampedArray([
      50, 50, 50, 255,  50, 50, 50, 255,  50, 50, 50, 255,
      50, 50, 50, 255, 200, 200, 200, 255,  50, 50, 50, 255,
      50, 50, 50, 255,  50, 50, 50, 255,  50, 50, 50, 255,
    ]);
    const imageData = new ImageData(data, 3, 3);
    unsharpMask(imageData, 0.3);

    // Center pixel should become brighter (edge enhancement)
    expect(imageData.data[16 + 0]).toBeGreaterThan(200);
  });

  it("enhanceImage applies both contrast stretch and unsharp mask", () => {
    const data = new Uint8ClampedArray([
      100, 100, 100, 255,
      150, 150, 150, 255,
      200, 200, 200, 255,
    ]);
    const imageData = new ImageData(data, 3, 1);
    enhanceImage(imageData);

    // After contrast stretch, min should be 0 and max should be 255
    const values = Array.from(imageData.data).filter((_, i) => i % 4 < 3);
    expect(Math.min(...values)).toBe(0);
    expect(Math.max(...values)).toBe(255);
  });
});
