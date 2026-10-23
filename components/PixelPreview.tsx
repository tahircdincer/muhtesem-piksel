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
    <figure className="flex w-full flex-col gap-2">
      <div className="relative aspect-square w-full overflow-hidden border-[3px] border-ink bg-stage shadow-[4px_4px_0_var(--ink)]">
        {pixels ? (
          <canvas ref={ref} className="h-full w-full [image-rendering:pixelated]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-panel p-2 text-center text-xs font-semibold">
            {children}
          </div>
        )}
      </div>
      <figcaption className="text-sm font-bold">
        {label}
        {pixels && <span className="font-medium text-ink-soft"> {R}×{R}</span>}
      </figcaption>
    </figure>
  );
}
