import { describe, expect, it } from "vitest";
import { applyPermutation, isPermutation, rankAssign } from "@/lib/assign";
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
