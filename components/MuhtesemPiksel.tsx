"use client";

import { useEffect, useMemo, useState } from "react";
import DropZone from "@/components/DropZone";
import PixelPreview from "@/components/PixelPreview";
import { applyPermutation, rankAssign } from "@/lib/assign";
import { rgbaToOklab } from "@/lib/color";
import { DEFAULT_RESOLUTION, decodeImage, loadTarget, squarePixels, type Resolution } from "@/lib/image";
import { strings } from "@/lib/strings";

type TargetState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; image: ImageBitmap };

export default function MuhtesemPiksel() {
  const [target, setTarget] = useState<TargetState>({ status: "loading" });
  const [sourceImage, setSourceImage] = useState<ImageBitmap | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [R] = useState<Resolution>(DEFAULT_RESOLUTION);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadTarget(strings.targetLoadFailed).then((res) => {
      if (cancelled) return;
      setTarget(res.ok ? { status: "ready", image: res.image } : { status: "error", message: res.message });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const targetPixels = useMemo(
    () => (target.status === "ready" ? squarePixels(target.image, R) : null),
    [target, R],
  );
  const sourcePixels = useMemo(() => (sourceImage ? squarePixels(sourceImage, R) : null), [sourceImage, R]);

  const dest = useMemo(() => {
    if (!sourcePixels || !targetPixels) return null;
    return rankAssign(rgbaToOklab(sourcePixels), rgbaToOklab(targetPixels), R * R);
  }, [sourcePixels, targetPixels, R]);

  const resultPixels = useMemo(
    () => (showResult && dest && sourcePixels ? applyPermutation(sourcePixels, dest) : null),
    [showResult, dest, sourcePixels],
  );

  const onFile = async (file: File) => {
    try {
      setSourceImage(await decodeImage(file));
      setSourceError(null);
      setShowResult(false);
    } catch {
      setSourceError(strings.imageLoadFailed);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center gap-6 p-6">
      <header className="text-center">
        <h1 className="text-xl font-semibold tracking-tight">{strings.appName}</h1>
        <p className="text-xs text-muted">{strings.tagline}</p>
      </header>

      <div className="grid w-full max-w-3xl grid-cols-3 gap-4">
        {sourcePixels ? (
          <PixelPreview label={strings.sourceLabel} pixels={sourcePixels} R={R} />
        ) : (
          <div className="flex flex-col gap-1.5">
            <DropZone onFile={onFile} />
            <span className="text-[11px] uppercase tracking-widest text-muted">{strings.sourceLabel}</span>
          </div>
        )}
        <PixelPreview label={strings.targetLabel} pixels={targetPixels} R={R}>
          {target.status === "loading" ? strings.targetLoading : target.status === "error" ? target.message : null}
        </PixelPreview>
        <PixelPreview label={strings.resultLabel} pixels={resultPixels} R={R} />
      </div>

      <div className="flex gap-2">
        {sourcePixels && <DropZone onFile={onFile} compact />}
        <button type="button" className="btn" disabled={!dest} onClick={() => setShowResult(true)}>
          {strings.showResult}
        </button>
      </div>
      {sourceError && <p className="text-xs text-red-400">{sourceError}</p>}
    </main>
  );
}
