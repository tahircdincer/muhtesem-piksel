// Pixel assignment: decides where every source pixel goes.
// Output is `dest`, a permutation: dest[i] = target index for source pixel i.
// Pure, no DOM, safe to run in a worker.

import { colorDist } from "./color";

/** Returns pixel indices sorted from darkest to lightest (OKLab L). Ties break by index. */
export function sortByLightness(lab: Float32Array, n: number): Uint32Array {
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => lab[a * 3] - lab[b * 3] || a - b);
  return order;
}

/**
 * Step A, rank matching: the k-th darkest source pixel goes to the
 * k-th darkest target pixel.
 */
export function rankAssign(srcLab: Float32Array, tgtLab: Float32Array, n: number): Uint32Array {
  const srcOrder = sortByLightness(srcLab, n);
  const tgtOrder = sortByLightness(tgtLab, n);
  const dest = new Uint32Array(n);
  for (let k = 0; k < n; k++) dest[srcOrder[k]] = tgtOrder[k];
  return dest;
}

/** Builds the final image: output pixel dest[i] gets source pixel i's exact RGBA. */
export function applyPermutation(srcRgba: Uint8ClampedArray, dest: Uint32Array): Uint8ClampedArray {
  const out = new Uint8ClampedArray(srcRgba.length);
  const src32 = new Uint32Array(srcRgba.buffer, srcRgba.byteOffset, dest.length);
  const out32 = new Uint32Array(out.buffer, 0, dest.length);
  for (let i = 0; i < dest.length; i++) out32[dest[i]] = src32[i];
  return out;
}

/** True if `dest` contains every index 0..n-1 exactly once. */
export function isPermutation(dest: Uint32Array): boolean {
  const seen = new Uint8Array(dest.length);
  for (let i = 0; i < dest.length; i++) {
    const t = dest[i];
    if (t >= dest.length || seen[t]) return false;
    seen[t] = 1;
  }
  return true;
}

/** Normalized pixel distance between flat indices p and q on an R×R grid. */
export function spatialDist(p: number, q: number, R: number): number {
  const dx = (p % R) - (q % R);
  const dy = ((p / R) | 0) - ((q / R) | 0);
  return Math.sqrt(dx * dx + dy * dy) / R;
}

/** cost(i→t) = colorDist(source[i], target[t]) + λ · spatialDist(pos(i), pos(t)) */
export function pairCost(
  srcLab: Float32Array,
  tgtLab: Float32Array,
  i: number,
  t: number,
  R: number,
  lambda: number,
): number {
  return colorDist(srcLab, i, tgtLab, t) + lambda * spatialDist(i, t, R);
}

/** Sum of pairCost over all source pixels. */
export function totalCost(
  dest: Uint32Array,
  srcLab: Float32Array,
  tgtLab: Float32Array,
  R: number,
  lambda: number,
): number {
  let sum = 0;
  for (let i = 0; i < dest.length; i++) sum += pairCost(srcLab, tgtLab, i, dest[i], R, lambda);
  return sum;
}
