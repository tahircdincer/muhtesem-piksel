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

// ---------------------------------------------------------------------------
// Step B: swap refinement
// ---------------------------------------------------------------------------

/** Weight of the spatial term. Higher = shorter, more coherent movement. Tune by eye. */
export const LAMBDA = 0.15;
/** Attempts per pixel. */
export const ITERATIONS_PER_PIXEL = 64;
/** Wall-time cap for refinement, in ms. */
export const TIME_BUDGET_MS = 3000;
/** Half-width of the neighbor windows used to pick swap partners. */
const RANK_WINDOW = 48;
const SPATIAL_WINDOW = 6;

export type RefineOptions = {
  lambda?: number;
  seed: number;
  /** Total swap attempts. Default N * ITERATIONS_PER_PIXEL. */
  iterations?: number;
  /** Stop early after this many ms. Default: no limit (deterministic). */
  timeBudgetMs?: number;
  now?: () => number;
  /** Called with progress in [0, 1], roughly every 2%. */
  onProgress?: (fraction: number) => void;
};

export type RefineResult = { attempts: number; swaps: number };

/**
 * Repeatedly picks two source pixels i, j and swaps their destinations if
 * that lowers cost(i→a) + cost(j→b). Mutates `dest` in place, so it stays a
 * valid permutation at every step.
 *
 * Partner j is picked three ways, in rotation:
 *  - uniformly at random (global moves),
 *  - near i in source-lightness order (similar colors, trade positions),
 *  - the source pixel whose destination is near i's destination (local cleanup).
 *
 * The hot loop uses typed arrays and plain numbers only.
 */
export function refine(
  dest: Uint32Array,
  srcLab: Float32Array,
  tgtLab: Float32Array,
  R: number,
  opts: RefineOptions,
): RefineResult {
  const n = dest.length;
  const lambda = (opts.lambda ?? LAMBDA) / R; // spatial distance normalized by R
  const total = opts.iterations ?? n * ITERATIONS_PER_PIXEL;
  const budget = opts.timeBudgetMs ?? Infinity;
  const now = opts.now ?? (() => Date.now());
  const onProgress = opts.onProgress;

  // Lightness order of the source and its inverse.
  const order = sortByLightness(srcLab, n);
  const rankOf = new Uint32Array(n);
  for (let k = 0; k < n; k++) rankOf[order[k]] = k;

  // inv[t] = source pixel currently assigned to target t.
  const inv = new Uint32Array(n);
  for (let i = 0; i < n; i++) inv[dest[i]] = i;

  // Inline xorshift32, seeded. Never 0.
  let s = (opts.seed ^ 0x2545f491) >>> 0 || 1;

  const start = now();
  const checkEvery = 8192;
  const progressStep = Math.max(1, Math.floor(total / 50));
  let nextProgress = progressStep;
  let swaps = 0;
  let it = 0;

  for (; it < total; it++) {
    if ((it & (checkEvery - 1)) === 0 && it > 0 && now() - start > budget) break;
    if (onProgress !== undefined && it >= nextProgress) {
      nextProgress += progressStep;
      const byTime = budget === Infinity ? 0 : (now() - start) / budget;
      const byIter = it / total;
      onProgress(byTime > byIter ? byTime : byIter);
    }

    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const i = (s >>> 0) % n;
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    const r = s >>> 0;

    let j: number;
    const mode = it % 3;
    if (mode === 0) {
      j = r % n;
    } else if (mode === 1) {
      let k = rankOf[i] + (r % (2 * RANK_WINDOW + 1)) - RANK_WINDOW;
      k = k < 0 ? 0 : k >= n ? n - 1 : k;
      j = order[k];
    } else {
      const a0 = dest[i];
      let x = (a0 % R) + (r % (2 * SPATIAL_WINDOW + 1)) - SPATIAL_WINDOW;
      let y = ((a0 / R) | 0) + (((r >>> 8) % (2 * SPATIAL_WINDOW + 1)) - SPATIAL_WINDOW);
      x = x < 0 ? 0 : x >= R ? R - 1 : x;
      y = y < 0 ? 0 : y >= R ? R - 1 : y;
      j = inv[y * R + x];
    }
    if (i === j) continue;

    const a = dest[i];
    const b = dest[j];
    const pi = i * 3;
    const pj = j * 3;
    const pa = a * 3;
    const pb = b * 3;
    const xi = i % R;
    const yi = (i / R) | 0;
    const xj = j % R;
    const yj = (j / R) | 0;
    const xa = a % R;
    const ya = (a / R) | 0;
    const xb = b % R;
    const yb = (b / R) | 0;

    let dL = srcLab[pi] - tgtLab[pa];
    let da = srcLab[pi + 1] - tgtLab[pa + 1];
    let db = srcLab[pi + 2] - tgtLab[pa + 2];
    let dx = xi - xa;
    let dy = yi - ya;
    const cIA = Math.sqrt(dL * dL + da * da + db * db) + lambda * Math.sqrt(dx * dx + dy * dy);

    dL = srcLab[pj] - tgtLab[pb];
    da = srcLab[pj + 1] - tgtLab[pb + 1];
    db = srcLab[pj + 2] - tgtLab[pb + 2];
    dx = xj - xb;
    dy = yj - yb;
    const cJB = Math.sqrt(dL * dL + da * da + db * db) + lambda * Math.sqrt(dx * dx + dy * dy);

    dL = srcLab[pi] - tgtLab[pb];
    da = srcLab[pi + 1] - tgtLab[pb + 1];
    db = srcLab[pi + 2] - tgtLab[pb + 2];
    dx = xi - xb;
    dy = yi - yb;
    const cIB = Math.sqrt(dL * dL + da * da + db * db) + lambda * Math.sqrt(dx * dx + dy * dy);

    dL = srcLab[pj] - tgtLab[pa];
    da = srcLab[pj + 1] - tgtLab[pa + 1];
    db = srcLab[pj + 2] - tgtLab[pa + 2];
    dx = xj - xa;
    dy = yj - ya;
    const cJA = Math.sqrt(dL * dL + da * da + db * db) + lambda * Math.sqrt(dx * dx + dy * dy);

    if (cIB + cJA < cIA + cJB) {
      dest[i] = b;
      dest[j] = a;
      inv[a] = j;
      inv[b] = i;
      swaps++;
    }
  }
  onProgress?.(1);
  return { attempts: it, swaps };
}

export type AssignOptions = RefineOptions & { refine?: boolean };

/** Full pipeline: OKLab conversion is done by the caller; rank match, then refine. */
export function assign(
  srcLab: Float32Array,
  tgtLab: Float32Array,
  R: number,
  opts: AssignOptions,
): { dest: Uint32Array; result: RefineResult | null } {
  const dest = rankAssign(srcLab, tgtLab, R * R);
  if (opts.refine === false) return { dest, result: null };
  return { dest, result: refine(dest, srcLab, tgtLab, R, opts) };
}
