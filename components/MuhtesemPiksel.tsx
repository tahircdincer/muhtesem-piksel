"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Controls from "@/components/Controls";
import DropZone from "@/components/DropZone";
import PixelPreview from "@/components/PixelPreview";
import PixelStage, { type StageHandle, type StageStatus } from "@/components/PixelStage";
import { buildParticles } from "@/lib/animate";
import { rankAssign } from "@/lib/assign";
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
  const [seed] = useState(1);
  const [status, setStatus] = useState<StageStatus>({ playing: false, direction: 1, progress: 0 });
  const stage = useRef<StageHandle>(null);

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
  const colors = useMemo(() => (sourcePixels ? new Uint32Array(sourcePixels.slice().buffer) : null), [sourcePixels]);

  const dest = useMemo(() => {
    if (!sourcePixels || !targetPixels) return null;
    return rankAssign(rgbaToOklab(sourcePixels), rgbaToOklab(targetPixels), R * R);
  }, [sourcePixels, targetPixels, R]);

  const particles = useMemo(() => (dest ? buildParticles(dest, R, seed) : null), [dest, R, seed]);

  const onFile = async (file: File) => {
    try {
      setSourceImage(await decodeImage(file));
      setSourceError(null);
    } catch {
      setSourceError(strings.imageLoadFailed);
    }
  };

  const ready = particles !== null;

  return (
    <main className="flex flex-1 flex-col items-center gap-4 p-4">
      <header className="text-center">
        <h1 className="text-lg font-semibold tracking-tight">{strings.appName}</h1>
      </header>

      <div className="relative aspect-square w-[min(92vw,calc(100vh-15rem))] overflow-hidden rounded-sm bg-background">
        <PixelStage
          ref={stage}
          R={R}
          particles={particles}
          colors={colors}
          idlePixels={sourcePixels}
          speed={1}
          dust={1}
          trails={false}
          smoothing
          onStatus={setStatus}
        />
        {!sourcePixels && (
          <div className="absolute inset-0 p-[12%]">
            <DropZone onFile={onFile} />
          </div>
        )}
      </div>

      <Controls
        ready={ready}
        playing={status.playing}
        onToggle={() => stage.current?.toggle()}
        onReplay={() => stage.current?.replay()}
        onShowEnd={() => stage.current?.showEnd()}
      >
        {sourcePixels && <DropZone onFile={onFile} compact />}
      </Controls>

      <div className="grid w-40 grid-cols-2 gap-2">
        <PixelPreview label={strings.sourceLabel} pixels={sourcePixels} R={R} />
        <PixelPreview label={strings.targetLabel} pixels={targetPixels} R={R}>
          {target.status === "loading" ? strings.targetLoading : target.status === "error" ? "!" : null}
        </PixelPreview>
      </div>
      {target.status === "error" && <p className="max-w-md text-center text-xs text-red-400">{target.message}</p>}
      {sourceError && <p className="text-xs text-red-400">{sourceError}</p>}
    </main>
  );
}
