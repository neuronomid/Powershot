/**
 * Image enhancement helpers: contrast stretch and unsharp mask.
 * These operate on canvas ImageData and are applied before JPEG encoding.
 */

/**
 * Apply histogram normalization (contrast stretch) to each RGB channel.
 */
export function contrastStretch(imageData: ImageData): ImageData {
  const data = imageData.data;
  const len = data.length;

  let rMin = 255, rMax = 0;
  let gMin = 255, gMax = 0;
  let bMin = 255, bMax = 0;

  for (let i = 0; i < len; i += 4) {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    if (r < rMin) rMin = r;
    if (r > rMax) rMax = r;
    if (g < gMin) gMin = g;
    if (g > gMax) gMax = g;
    if (b < bMin) bMin = b;
    if (b > bMax) bMax = b;
  }

  const rRange = rMax - rMin || 1;
  const gRange = gMax - gMin || 1;
  const bRange = bMax - bMin || 1;

  for (let i = 0; i < len; i += 4) {
    data[i] = Math.min(255, Math.max(0, ((data[i]! - rMin) * 255) / rRange));
    data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1]! - gMin) * 255) / gRange));
    data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2]! - bMin) * 255) / bRange));
  }

  return imageData;
}

/**
 * Apply a simple box blur with radius 1 (3x3 kernel) to a copy of the image.
 */
function boxBlur1(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const output = new Uint8ClampedArray(data);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += data[idx]!;
          }
        }
        const outIdx = (y * width + x) * 4 + c;
        output[outIdx] = Math.round(sum / 9);
      }
    }
  }

  return new ImageData(output, width, height);
}

/**
 * Apply an unsharp mask: result = original + amount * (original - blurred).
 * Uses a box blur with radius 1 as an approximation of Gaussian blur.
 */
export function unsharpMask(imageData: ImageData, amount = 0.3): ImageData {
  const blurred = boxBlur1(imageData);
  const data = imageData.data;
  const bData = blurred.data;
  const len = data.length;

  for (let i = 0; i < len; i += 4) {
    data[i] = Math.min(255, Math.max(0, data[i]! + amount * (data[i]! - bData[i]!)));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1]! + amount * (data[i + 1]! - bData[i + 1]!)));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2]! + amount * (data[i + 2]! - bData[i + 2]!)));
  }

  return imageData;
}

/**
 * Apply the full enhancement pipeline: contrast stretch + unsharp mask.
 */
export function enhanceImage(imageData: ImageData): ImageData {
  contrastStretch(imageData);
  unsharpMask(imageData, 0.3);
  return imageData;
}
