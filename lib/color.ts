// sRGB -> OKLab conversion and color distance. Pure, no DOM.

const SRGB_TO_LINEAR = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LINEAR[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Converts RGBA pixels (4 bytes each, alpha ignored) to OKLab.
 * Returns a Float32Array of length 3N laid out as [L, a, b, L, a, b, ...].
 */
export function rgbaToOklab(rgba: ArrayLike<number>, out?: Float32Array): Float32Array {
  const n = (rgba.length / 4) | 0;
  const lab = out ?? new Float32Array(n * 3);
  for (let i = 0, p = 0, q = 0; i < n; i++, p += 4, q += 3) {
    const r = SRGB_TO_LINEAR[rgba[p]];
    const g = SRGB_TO_LINEAR[rgba[p + 1]];
    const b = SRGB_TO_LINEAR[rgba[p + 2]];

    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

    lab[q] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    lab[q + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    lab[q + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  }
  return lab;
}

/** Euclidean OKLab distance between pixel i of `labA` and pixel j of `labB`. */
export function colorDist(labA: Float32Array, i: number, labB: Float32Array, j: number): number {
  const p = i * 3;
  const q = j * 3;
  const dL = labA[p] - labB[q];
  const da = labA[p + 1] - labB[q + 1];
  const db = labA[p + 2] - labB[q + 2];
  return Math.sqrt(dL * dL + da * da + db * db);
}
