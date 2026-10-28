// Runs the assignment off the main thread.

import { TIME_BUDGET_MS, assign } from "./assign";
import { rgbaToOklab } from "./color";

export type AssignRequest = {
  id: number;
  source: Uint8ClampedArray;
  target: Uint8ClampedArray;
  R: number;
  seed: number;
};

export type AssignResponse =
  | { id: number; type: "progress"; fraction: number }
  | { id: number; type: "done"; dest: Uint32Array; ms: number };

type WorkerScope = {
  onmessage: ((e: MessageEvent<AssignRequest>) => void) | null;
  postMessage: (message: AssignResponse, transfer?: Transferable[]) => void;
};

const scope = self as unknown as WorkerScope;

// Share of the progress bar for the rank-matching step.
const RANK_SHARE = 0.08;

scope.onmessage = (e) => {
  const { id, source, target, R, seed } = e.data;
  const t0 = performance.now();
  scope.postMessage({ id, type: "progress", fraction: 0 });

  const srcLab = rgbaToOklab(source);
  const tgtLab = rgbaToOklab(target);
  const { dest } = assign(srcLab, tgtLab, R, {
    seed,
    timeBudgetMs: TIME_BUDGET_MS,
    now: () => performance.now(),
    onProgress: (f) => scope.postMessage({ id, type: "progress", fraction: RANK_SHARE + f * (1 - RANK_SHARE) }),
  });

  scope.postMessage({ id, type: "done", dest, ms: performance.now() - t0 }, [dest.buffer]);
};
