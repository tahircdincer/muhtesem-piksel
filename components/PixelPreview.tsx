"use client";

import { useEffect, useRef } from "react";
import { drawPixels } from "@/lib/image";

type Props = {
  label: string;
  pixels: Uint8ClampedArray | null;
  R: number;
  children?: React.ReactNode;
};

/** Small square thumbnail of R×R pixels (nearest-neighbor upscaled). */
export default function PixelPreview({ label, pixels, R, children }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current && pixels) drawPixels(ref.current, pixels, R);
  }, [pixels, R]);

  return (
    <figure className="flex w-full flex-col gap-1.5">
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-border bg-panel">
        {pixels ? (
          <canvas ref={ref} className="h-full w-full [image-rendering:pixelated]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-3 text-center text-xs text-muted">
            {children}
          </div>
        )}
      </div>
      <figcaption className="text-[11px] uppercase tracking-widest text-muted">
        {label}
        {pixels ? ` · ${R}×${R}` : ""}
      </figcaption>
    </figure>
  );
}
