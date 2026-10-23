// Records the stage to a .webm with canvas.captureStream + MediaRecorder.
// Browser-only.

export const RECORD_SIZE = 1080;
export const RECORD_FPS = 60;
/** Keep recording this long after the animation ends, in ms. */
export const RECORD_TAIL_MS = 1000;

const MIME_CANDIDATES = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];

export function canRecord(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype
  );
}

function pickMime(): string | undefined {
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export type Recording = { stop: () => Promise<Blob> };

/**
 * Starts recording. Every animation frame, `getFrame()` (the R×R stage frame)
 * is drawn scaled into a RECORD_SIZE square canvas that feeds the recorder.
 */
export function startRecording(
  getFrame: () => HTMLCanvasElement | null,
  getSmoothing: () => boolean,
): Recording {
  const canvas = document.createElement("canvas");
  canvas.width = RECORD_SIZE;
  canvas.height = RECORD_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");

  let raf = 0;
  const paint = () => {
    const frame = getFrame();
    if (frame) {
      ctx.imageSmoothingEnabled = getSmoothing();
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(frame, 0, 0, RECORD_SIZE, RECORD_SIZE);
    }
    raf = requestAnimationFrame(paint);
  };
  paint();

  const stream = canvas.captureStream(RECORD_FPS);
  const mimeType = pickMime();
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start(250);

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          cancelAnimationFrame(raf);
          stream.getTracks().forEach((t) => t.stop());
          resolve(new Blob(chunks, { type: mimeType ?? "video/webm" }));
        };
        recorder.stop();
      }),
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
