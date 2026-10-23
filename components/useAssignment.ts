"use client";

import { useEffect, useState } from "react";
import type { AssignRequest, AssignResponse } from "@/lib/assign.worker";

export type AssignmentState = {
  dest: Uint32Array | null;
  /** 0..1 while computing, null when idle. */
  progress: number | null;
};

let nextId = 1;

/**
 * Computes `dest` in a Web Worker whenever the inputs change.
 * A running job is terminated when the inputs change again.
 */
export function useAssignment(
  source: Uint8ClampedArray | null,
  target: Uint8ClampedArray | null,
  R: number,
  seed: number,
): AssignmentState {
  const [state, setState] = useState<AssignmentState>({ dest: null, progress: null });

  useEffect(() => {
    if (!source || !target || source.length !== target.length) return;

    const id = nextId++;
    const worker = new Worker(new URL("../lib/assign.worker.ts", import.meta.url), { type: "module" });
    // Reset while the new job runs (async so we don't set state during the effect body).
    queueMicrotask(() => setState({ dest: null, progress: 0 }));

    worker.onmessage = (e: MessageEvent<AssignResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === "progress") {
        setState((s) => (s.progress === null ? s : { dest: null, progress: msg.fraction }));
      } else {
        setState({ dest: msg.dest, progress: null });
        worker.terminate();
      }
    };

    // Copies, so the main thread keeps its pixels.
    const req: AssignRequest = { id, source: source.slice(), target: target.slice(), R, seed };
    worker.postMessage(req, [req.source.buffer, req.target.buffer]);

    return () => worker.terminate();
  }, [source, target, R, seed]);

  return state;
}
