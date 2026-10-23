"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { renderFrame, type Particles } from "@/lib/animate";

/** Default full runtime at speed 1×, in seconds. */
export const BASE_SECONDS = 6;
/** Trails: fraction of the old frame removed per 1/60 s. */
const TRAIL_FADE = 0.14;
const BG = { r: 5, g: 5, b: 6 };
const BG_CSS = `rgb(${BG.r}, ${BG.g}, ${BG.b})`;

export type StageStatus = { playing: boolean; direction: 1 | -1; progress: number };

export type StageHandle = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  replay: () => void;
  reverse: () => void;
  showEnd: () => void;
  /** The internal R×R composited canvas (used by the recorder). */
  getFrameCanvas: () => HTMLCanvasElement | null;
};

type Props = {
  ref?: Ref<StageHandle>;
  R: number;
  particles: Particles | null;
  /** Packed RGBA color of each source pixel. */
  colors: Uint32Array | null;
  /** Shown when there are no particles yet (e.g. the plain source image). */
  idlePixels: Uint8ClampedArray | null;
  speed: number;
  dust: number;
  trails: boolean;
  smoothing: boolean;
  onStatus?: (status: StageStatus) => void;
};

type Buffers = {
  R: number;
  image: ImageData;
  pixels: Uint32Array;
  posX: Float32Array;
  posY: Float32Array;
  layer: HTMLCanvasElement;
  layerCtx: CanvasRenderingContext2D;
  frame: HTMLCanvasElement;
  frameCtx: CanvasRenderingContext2D;
};

function makeBuffers(R: number): Buffers | null {
  const layer = document.createElement("canvas");
  const frame = document.createElement("canvas");
  layer.width = layer.height = frame.width = frame.height = R;
  const layerCtx = layer.getContext("2d");
  const frameCtx = frame.getContext("2d");
  if (!layerCtx || !frameCtx) return null;
  const image = new ImageData(R, R);
  return {
    R,
    image,
    pixels: new Uint32Array(image.data.buffer),
    posX: new Float32Array(R * R),
    posY: new Float32Array(R * R),
    layer,
    layerCtx,
    frame,
    frameCtx,
  };
}

export default function PixelStage({
  ref,
  R,
  particles,
  colors,
  idlePixels,
  speed,
  dust,
  trails,
  smoothing,
  onStatus,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffers = useRef<Buffers | null>(null);
  const g = useRef(0);
  const direction = useRef<1 | -1>(1);
  const playing = useRef(false);
  const raf = useRef(0);
  const lastTime = useRef(0);

  // Latest props, readable from the animation loop without re-subscribing.
  const live = useRef({ particles, colors, idlePixels, speed, dust, trails, smoothing, onStatus });
  useEffect(() => {
    live.current = { particles, colors, idlePixels, speed, dust, trails, smoothing, onStatus };
  });

  const emit = useCallback(() => {
    live.current.onStatus?.({ playing: playing.current, direction: direction.current, progress: g.current });
  }, []);

  /** Draws the current progress. `dt` (seconds) drives the trail fade. */
  const draw = useCallback(
    (dt: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      if (!buffers.current || buffers.current.R !== R) buffers.current = makeBuffers(R);
      const b = buffers.current;
      if (!b) return;
      const { particles: p, colors: c, idlePixels: idle, dust: d, trails: tr, smoothing: sm } = live.current;

      let hasContent = true;
      if (p && c && p.R === R) {
        renderFrame(p, c, g.current, d, b.posX, b.posY, b.pixels);
      } else if (idle && idle.length === R * R * 4) {
        b.image.data.set(idle);
      } else {
        hasContent = false;
      }

      // Composite: background (or faded previous frame), then this frame's particles.
      const fctx = b.frameCtx;
      if (tr && playing.current) {
        const alpha = 1 - Math.pow(1 - TRAIL_FADE, Math.max(dt, 1 / 240) * 60);
        fctx.globalAlpha = Math.min(1, alpha);
        fctx.fillStyle = BG_CSS;
        fctx.fillRect(0, 0, R, R);
        fctx.globalAlpha = 1;
      } else {
        fctx.fillStyle = BG_CSS;
        fctx.fillRect(0, 0, R, R);
      }
      if (hasContent) {
        b.layerCtx.putImageData(b.image, 0, 0);
        fctx.drawImage(b.layer, 0, 0);
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = sm;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = BG_CSS;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(b.frame, 0, 0, canvas.width, canvas.height);
    },
    [R],
  );

  const stop = useCallback(() => {
    playing.current = false;
    cancelAnimationFrame(raf.current);
  }, []);

  /** Advances one animation frame. Returns false when playback should stop. */
  const step = useCallback(
    (now: number): boolean => {
      if (!playing.current) return false;
      const dt = Math.min(0.1, (now - lastTime.current) / 1000);
      lastTime.current = now;
      const next = g.current + (direction.current * dt * live.current.speed) / BASE_SECONDS;
      g.current = next <= 0 ? 0 : next >= 1 ? 1 : next;
      const finished = (direction.current === 1 && g.current >= 1) || (direction.current === -1 && g.current <= 0);
      if (finished) playing.current = false;
      draw(dt);
      if (finished) emit();
      return !finished;
    },
    [draw, emit],
  );

  const play = useCallback(() => {
    const { particles: p } = live.current;
    if (!p || playing.current) return;
    // At the end of the current direction: start over.
    if (direction.current === 1 && g.current >= 1) g.current = 0;
    if (direction.current === -1 && g.current <= 0) g.current = 1;
    playing.current = true;
    lastTime.current = performance.now();
    const frame = (now: number) => {
      if (step(now)) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    emit();
  }, [emit, step]);

  const pause = useCallback(() => {
    stop();
    draw(0);
    emit();
  }, [draw, emit, stop]);

  useImperativeHandle(
    ref,
    () => ({
      play,
      pause,
      toggle: () => (playing.current ? pause() : play()),
      replay: () => {
        stop();
        g.current = direction.current === 1 ? 0 : 1;
        play();
      },
      // Flip direction and keep going from the current position
      // (from an end, this plays the whole way back).
      reverse: () => {
        stop();
        direction.current = direction.current === 1 ? -1 : 1;
        play();
      },
      // Jump to the finished result (always the target, whatever the direction).
      showEnd: () => {
        stop();
        direction.current = 1;
        g.current = 1;
        draw(0);
        emit();
      },
      getFrameCanvas: () => buffers.current?.frame ?? null,
    }),
    [draw, emit, pause, play, stop],
  );

  // New particles (new image, seed or resolution): rewind to the start.
  useEffect(() => {
    stop();
    g.current = direction.current === 1 ? 0 : 1;
    draw(0);
    emit();
  }, [particles, R, draw, emit, stop]);

  // Redraw when idle content or visual settings change while paused.
  useEffect(() => {
    if (!playing.current) draw(0);
  }, [idlePixels, dust, trails, smoothing, draw]);

  // Keep the canvas backing store at device resolution.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const size = Math.max(1, Math.round(canvas.clientWidth * dpr));
      if (canvas.width !== size || canvas.height !== size) {
        canvas.width = size;
        canvas.height = size;
        if (!playing.current) draw(0);
      }
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  useEffect(() => stop, [stop]);

  return <canvas ref={canvasRef} className="block aspect-square h-full w-full" />;
}
