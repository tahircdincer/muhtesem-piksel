import { describe, expect, it } from "vitest";
import { LAMBDA, applyPermutation, assign, isPermutation, rankAssign, refine, totalCost } from "@/lib/assign";
import { rgbaToOklab } from "@/lib/color";
import { colorMultiset, disc, gradient, noise } from "./helpers";

const R = 32;
const N = R * R;

const cases: Array<[string, Uint8ClampedArray, Uint8ClampedArray]> = [
  ["noise → disc", noise(R, 1), disc(R)],
  ["gradient → disc", gradient(R), disc(R)],
  ["noise → gradient", noise(R, 7), gradient(R)],
];

describe("rank matching", () => {
  it.each(cases)("is a valid permutation (%s)", (_name, src, tgt) => {
    const dest = rankAssign(rgbaToOklab(src), rgbaToOklab(tgt), N);
    expect(dest.length).toBe(N);
    expect(isPermutation(dest)).toBe(true);
  });

  it.each(cases)("preserves the multiset of source colors (%s)", (_name, src, tgt) => {
    const dest = rankAssign(rgbaToOklab(src), rgbaToOklab(tgt), N);
    const out = applyPermutation(src, dest);
    expect(colorMultiset(out)).toEqual(colorMultiset(src));
  });

  it("puts darker source pixels where the target is darker", () => {
    const src = noise(R, 3);
    const tgt = disc(R);
    const srcLab = rgbaToOklab(src);
    const tgtLab = rgbaToOklab(tgt);
    const outLab = rgbaToOklab(applyPermutation(src, rankAssign(srcLab, tgtLab, N)));
    // Center of the disc (bright in target) should be brighter than the corner.
    const center = (R / 2) * R + R / 2;
    expect(outLab[center * 3]).toBeGreaterThan(outLab[0]);
  });

  it("detects non-permutations", () => {
    expect(isPermutation(new Uint32Array([0, 1, 2]))).toBe(true);
    expect(isPermutation(new Uint32Array([0, 0, 2]))).toBe(false);
    expect(isPermutation(new Uint32Array([0, 1, 3]))).toBe(false);
  });
});

describe("swap refinement", () => {
  it.each(cases)("lowers total cost vs rank matching alone (%s)", (_name, src, tgt) => {
    const srcLab = rgbaToOklab(src);
    const tgtLab = rgbaToOklab(tgt);
    const dest = rankAssign(srcLab, tgtLab, N);
    const before = totalCost(dest, srcLab, tgtLab, R, LAMBDA);
    const { swaps } = refine(dest, srcLab, tgtLab, R, { seed: 1234 });
    const after = totalCost(dest, srcLab, tgtLab, R, LAMBDA);
    expect(swaps).toBeGreaterThan(0);
    expect(after).toBeLessThan(before);
  });

  it.each(cases)("still yields a valid permutation with preserved colors (%s)", (_name, src, tgt) => {
    const { dest } = assign(rgbaToOklab(src), rgbaToOklab(tgt), R, { seed: 99 });
    expect(isPermutation(dest)).toBe(true);
    expect(colorMultiset(applyPermutation(src, dest))).toEqual(colorMultiset(src));
  });

  it("is deterministic: same inputs and seed give identical dest", () => {
    const src = noise(R, 11);
    const tgt = disc(R);
    const run = (seed: number) => Array.from(assign(rgbaToOklab(src), rgbaToOklab(tgt), R, { seed }).dest);
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it("reports progress up to 1", () => {
    const seen: number[] = [];
    refine(rankAssign(rgbaToOklab(noise(R, 2)), rgbaToOklab(disc(R)), N), rgbaToOklab(noise(R, 2)), rgbaToOklab(disc(R)), R, {
      seed: 1,
      onProgress: (f) => seen.push(f),
    });
    expect(seen.length).toBeGreaterThan(40);
    expect(seen[seen.length - 1]).toBe(1);
  });
});
