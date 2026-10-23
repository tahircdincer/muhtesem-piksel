import { describe, expect, it } from "vitest";
import {
  DURATION_BASE,
  DURATION_JITTER,
  MAX_DELAY,
  buildParticles,
  computePositions,
  renderFrame,
} from "@/lib/animate";
import { applyPermutation, rankAssign } from "@/lib/assign";
import { rgbaToOklab } from "@/lib/color";
import { disc, noise } from "./helpers";

const R = 32;
const N = R * R;

function setup(seed = 42) {
  const src = noise(R, 5);
  const tgt = disc(R);
  const dest = rankAssign(rgbaToOklab(src), rgbaToOklab(tgt), N);
  const particles = buildParticles(dest, R, seed);
  const colors = new Uint32Array(src.buffer, 0, N);
  return { src, dest, particles, colors };
}

describe("animation", () => {
  it("timing fits inside [0, 1]", () => {
    expect(MAX_DELAY + DURATION_BASE + DURATION_JITTER).toBeLessThanOrEqual(1);
    const { particles } = setup();
    for (let i = 0; i < N; i++) {
      expect(particles.delay[i] + particles.duration[i]).toBeLessThanOrEqual(1);
    }
  });

  it.each([0, 1, 2])("lands every particle exactly on its target at t = 1 (dust %d)", (dust) => {
    const { particles, dest } = setup();
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    computePositions(particles, 1, dust, x, y);
    for (let i = 0; i < N; i++) {
      expect(x[i]).toBe(dest[i] % R);
      expect(y[i]).toBe(Math.floor(dest[i] / R));
    }
  });

  it("starts every particle exactly at its source position at t = 0", () => {
    const { particles } = setup();
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    computePositions(particles, 0, 1, x, y);
    for (let i = 0; i < N; i++) {
      expect(x[i]).toBe(i % R);
      expect(y[i]).toBe(Math.floor(i / R));
    }
  });

  it("actually moves particles mid-flight", () => {
    const { particles } = setup();
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    computePositions(particles, 0.5, 1, x, y);
    let moved = 0;
    for (let i = 0; i < N; i++) if (x[i] !== i % R || y[i] !== Math.floor(i / R)) moved++;
    expect(moved).toBeGreaterThan(N / 2);
  });

  it("last frame equals the permuted image exactly; first frame equals the source", () => {
    const { src, dest, particles, colors } = setup();
    const px = new Float32Array(N);
    const py = new Float32Array(N);
    const buf = new Uint32Array(N);

    renderFrame(particles, colors, 1, 1, px, py, buf);
    const expected = applyPermutation(src, dest);
    expect(Array.from(buf)).toEqual(Array.from(new Uint32Array(expected.buffer)));

    renderFrame(particles, colors, 0, 1, px, py, buf);
    expect(Array.from(buf)).toEqual(Array.from(colors));
  });

  it("is deterministic: same dest and seed give identical frames", () => {
    const a = setup(7);
    const b = setup(7);
    const c = setup(8);
    expect(Array.from(a.dest)).toEqual(Array.from(b.dest));
    const frame = (s: ReturnType<typeof setup>, g: number) => {
      const buf = new Uint32Array(N);
      renderFrame(s.particles, s.colors, g, 1, new Float32Array(N), new Float32Array(N), buf);
      return Array.from(buf);
    };
    for (const g of [0.2, 0.45, 0.7]) expect(frame(a, g)).toEqual(frame(b, g));
    expect(frame(a, 0.45)).not.toEqual(frame(c, 0.45));
  });
});
