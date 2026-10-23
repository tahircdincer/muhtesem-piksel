// Small synthetic test images. Never depends on the real target file.

import { mulberry32 } from "@/lib/rng";

/** Diagonal RGB gradient. */
export function gradient(R: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(R * R * 4);
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const p = (y * R + x) * 4;
      out[p] = Math.round((x / (R - 1)) * 255);
      out[p + 1] = Math.round((y / (R - 1)) * 255);
      out[p + 2] = Math.round(((x + y) / (2 * (R - 1))) * 255);
      out[p + 3] = 255;
    }
  }
  return out;
}

/** Uniform random color noise. */
export function noise(R: number, seed: number): Uint8ClampedArray {
  const rand = mulberry32(seed);
  const out = new Uint8ClampedArray(R * R * 4);
  for (let p = 0; p < out.length; p += 4) {
    out[p] = Math.floor(rand() * 256);
    out[p + 1] = Math.floor(rand() * 256);
    out[p + 2] = Math.floor(rand() * 256);
    out[p + 3] = 255;
  }
  return out;
}

/** A bright disc on a dark background: a stand-in "face". */
export function disc(R: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(R * R * 4);
  const c = (R - 1) / 2;
  for (let y = 0; y < R; y++) {
    for (let x = 0; x < R; x++) {
      const d = Math.hypot(x - c, y - c) / (R / 2);
      const v = d < 0.6 ? 230 - Math.round(d * 80) : 20 + Math.round(d * 30);
      const p = (y * R + x) * 4;
      out[p] = v;
      out[p + 1] = v;
      out[p + 2] = v;
      out[p + 3] = 255;
    }
  }
  return out;
}

/** Sorted list of packed RGBA colors, for multiset comparison. */
export function colorMultiset(rgba: Uint8ClampedArray): Uint32Array {
  const n = rgba.length / 4;
  const out = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    out[i] = ((rgba[p] << 24) | (rgba[p + 1] << 16) | (rgba[p + 2] << 8) | rgba[p + 3]) >>> 0;
  }
  return out.sort();
}
