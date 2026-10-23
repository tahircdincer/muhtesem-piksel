// Browser-only helpers: decode an image, center-crop it to a square,
// resample it to R×R and read its RGBA pixels.
//
// Resampling happens here, BEFORE assignment. After assignment, pixels are
// only ever moved, never resampled or blended.

export const RESOLUTIONS = [128, 192, 256, 384] as const;
export type Resolution = (typeof RESOLUTIONS)[number];
export const DEFAULT_RESOLUTION: Resolution = 256;

export async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

type Canvas2D = {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
};

function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("2D canvas not available");
    return { canvas, ctx };
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas not available");
  return { canvas, ctx };
}

/**
 * Center-crops `image` to a square and resamples it to R×R.
 * Transparency is flattened onto black and alpha is forced to 255.
 */
export function squarePixels(image: ImageBitmap, R: number): Uint8ClampedArray {
  const side = Math.min(image.width, image.height);
  const sx = (image.width - side) / 2;
  const sy = (image.height - side) / 2;

  // Downscale in halving steps first so large photos don't alias.
  let source: CanvasImageSource = image;
  let srcX = sx;
  let srcY = sy;
  let srcSide = side;
  while (srcSide / 2 >= R * 2) {
    const next = Math.floor(srcSide / 2);
    const step = makeCanvas(next, next);
    step.ctx.imageSmoothingEnabled = true;
    step.ctx.imageSmoothingQuality = "high";
    step.ctx.drawImage(source, srcX, srcY, srcSide, srcSide, 0, 0, next, next);
    source = step.canvas;
    srcX = 0;
    srcY = 0;
    srcSide = next;
  }

  const { ctx } = makeCanvas(R, R);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, R, R);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, srcX, srcY, srcSide, srcSide, 0, 0, R, R);

  const data = ctx.getImageData(0, 0, R, R).data;
  for (let i = 3; i < data.length; i += 4) data[i] = 255;
  return data;
}

/** Draws raw R×R RGBA pixels into a canvas at native size. */
export function drawPixels(canvas: HTMLCanvasElement, rgba: Uint8ClampedArray, R: number): void {
  if (canvas.width !== R) canvas.width = R;
  if (canvas.height !== R) canvas.height = R;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = new ImageData(R, R);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
}

export type TargetResult =
  | { ok: true; image: ImageBitmap }
  | { ok: false; message: string };

/** Loads the target image from the local API route. */
export async function loadTarget(fallbackMessage: string): Promise<TargetResult> {
  try {
    const res = await fetch("/api/target", { cache: "no-store" });
    if (!res.ok) {
      let message = fallbackMessage;
      try {
        const body: unknown = await res.json();
        if (body && typeof body === "object" && "error" in body && typeof body.error === "string") {
          message = body.error;
        }
      } catch {
        // keep fallback
      }
      return { ok: false, message };
    }
    const image = await decodeImage(await res.blob());
    return { ok: true, image };
  } catch {
    return { ok: false, message: fallbackMessage };
  }
}
