// Per-particle timing and path math, plus the pure frame renderer.
// Pure, no DOM. All randomness is seeded so replays are identical.

import { hash2, mulberry32 } from "./rng";

/** Global progress g ∈ [0, 1] maps to each particle's local t via delay/duration. */
export const MAX_DELAY = 0.5;
export const DURATION_BASE = 0.42;
export const DURATION_JITTER = 0.08; // MAX_DELAY + DURATION_BASE + DURATION_JITTER <= 1

/** Sweep direction of the crumbling front, in radians (left→right, tilted down). */
export const SWEEP_ANGLE = (22 * Math.PI) / 180;
/** How much 2D value noise roughens the sweep front (0 = straight line). */
export const SWEEP_NOISE = 0.35;
/** Value-noise cell size as a fraction of R. */
export const NOISE_SCALE = 0.12;

export const CURL_MAX = 0.35;
/** Jitter amplitude in pixels at R = 256 (scaled with R). */
export const JITTER_PX = 1.6;

export type Particles = {
  n: number;
  R: number;
  sx: Float32Array;
  sy: Float32Array;
  ex: Float32Array;
  ey: Float32Array;
  delay: Float32Array;
  duration: Float32Array;
  curl: Float32Array;
  driftX: Float32Array;
  driftY: Float32Array;
  phaseX: Float32Array;
  phaseY: Float32Array;
};

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 2D value noise in [0, 1). */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Precomputes start/end and the seeded motion parameters for every particle. */
export function buildParticles(dest: Uint32Array, R: number, seed: number): Particles {
  const n = dest.length;
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const p: Particles = {
    n,
    R,
    sx: new Float32Array(n),
    sy: new Float32Array(n),
    ex: new Float32Array(n),
    ey: new Float32Array(n),
    delay: new Float32Array(n),
    duration: new Float32Array(n),
    curl: new Float32Array(n),
    driftX: new Float32Array(n),
    driftY: new Float32Array(n),
    phaseX: new Float32Array(n),
    phaseY: new Float32Array(n),
  };

  const cos = Math.cos(SWEEP_ANGLE);
  const sin = Math.sin(SWEEP_ANGLE);
  const span = (R - 1) * (cos + sin);
  const cell = Math.max(1, R * NOISE_SCALE);

  for (let i = 0; i < n; i++) {
    const x = i % R;
    const y = (i / R) | 0;
    const t = dest[i];
    p.sx[i] = x;
    p.sy[i] = y;
    p.ex[i] = t % R;
    p.ey[i] = (t / R) | 0;

    const front = span > 0 ? (x * cos + y * sin) / span : 0;
    const noise = valueNoise(x / cell, y / cell, seed) - 0.5;
    let d = front + noise * SWEEP_NOISE + (rand() - 0.5) * 0.06;
    d = d < 0 ? 0 : d > 1 ? 1 : d;
    p.delay[i] = d * MAX_DELAY;
    p.duration[i] = DURATION_BASE + rand() * DURATION_JITTER;

    p.curl[i] = (rand() * 2 - 1) * CURL_MAX;
    p.driftX[i] = R * (-0.03 + rand() * 0.11);
    p.driftY[i] = -R * (0.04 + rand() * 0.14);
    p.phaseX[i] = rand() * Math.PI * 2;
    p.phaseY[i] = rand() * Math.PI * 2;
  }
  return p;
}

/** Local progress of particle i at global progress g. */
export function localT(p: Particles, i: number, g: number): number {
  const t = (g - p.delay[i]) / p.duration[i];
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
}

/**
 * Writes every particle's position at global progress g into outX/outY.
 * At local t = 0 a particle is exactly at its start; at t = 1 exactly at its end.
 */
export function computePositions(
  p: Particles,
  g: number,
  dust: number,
  outX: Float32Array,
  outY: Float32Array,
): void {
  const { n, sx, sy, ex, ey, delay, duration, curl, driftX, driftY, phaseX, phaseY } = p;
  // Exact endpoints regardless of float rounding in delay/duration.
  if (g >= 1) {
    outX.set(ex);
    outY.set(ey);
    return;
  }
  if (g <= 0) {
    outX.set(sx);
    outY.set(sy);
    return;
  }
  const jitter = JITTER_PX * (p.R / 256) * dust;
  for (let i = 0; i < n; i++) {
    let t = (g - delay[i]) / duration[i];
    if (t <= 0) {
      outX[i] = sx[i];
      outY[i] = sy[i];
      continue;
    }
    if (t >= 1) {
      outX[i] = ex[i];
      outY[i] = ey[i];
      continue;
    }
    const x0 = sx[i];
    const y0 = sy[i];
    const dx = ex[i] - x0;
    const dy = ey[i] - y0;
    const e = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) * (-2 * t + 2) * (-2 * t + 2)) / 2;
    const s = Math.sin(Math.PI * t);
    const arc = curl[i] * s * dust;
    const wind = s * dust;
    const wob = 6.0 * t;
    t = s * jitter;
    outX[i] = x0 + dx * e - dy * arc + driftX[i] * wind + Math.sin(wob + phaseX[i]) * t;
    outY[i] = y0 + dy * e + dx * arc + driftY[i] * wind + Math.sin(wob * 1.3 + phaseY[i]) * t;
  }
}

/**
 * Renders one frame into `buffer` (R×R packed RGBA). The buffer is cleared to
 * transparent, then each particle writes its exact source color at round(pos).
 * Gaps are left as-is (that's the dust look).
 */
export function renderFrame(
  p: Particles,
  colors: Uint32Array,
  g: number,
  dust: number,
  posX: Float32Array,
  posY: Float32Array,
  buffer: Uint32Array,
): void {
  computePositions(p, g, dust, posX, posY);
  buffer.fill(0);
  const R = p.R;
  for (let i = 0; i < p.n; i++) {
    const x = Math.floor(posX[i] + 0.5);
    const y = Math.floor(posY[i] + 0.5);
    if (x < 0 || y < 0 || x >= R || y >= R) continue;
    buffer[y * R + x] = colors[i];
  }
}
