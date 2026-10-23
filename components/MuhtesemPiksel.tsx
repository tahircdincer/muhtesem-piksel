"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Controls, { type Settings } from "@/components/Controls";
import DropZone from "@/components/DropZone";
import PixelPreview from "@/components/PixelPreview";
import PixelStage, { type StageHandle, type StageStatus } from "@/components/PixelStage";
import { useAssignment } from "@/components/useAssignment";
import { buildParticles } from "@/lib/animate";
import { DEFAULT_RESOLUTION, decodeImage, loadTarget, squarePixels } from "@/lib/image";
import { RECORD_TAIL_MS, canRecord, downloadBlob, startRecording, type Recording } from "@/lib/record";
import { randomSeed } from "@/lib/rng";
import { strings } from "@/lib/strings";

type TargetState =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; image: ImageBitmap };

const DEFAULT_SETTINGS: Settings = {
  speed: 1,
  dust: 1,
  trails: false,
  smoothing: true,
  R: DEFAULT_RESOLUTION,
};

const noopSubscribe = () => () => {};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  return el instanceof HTMLInputElement && el.type !== "range" && el.type !== "checkbox";
}

export default function MuhtesemPiksel() {
  const [target, setTarget] = useState<TargetState>({ status: "loading" });
  const [sourceImage, setSourceImage] = useState<ImageBitmap | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [seed, setSeed] = useState(1);
  const [status, setStatus] = useState<StageStatus>({ playing: false, direction: 1, progress: 0 });
  const [clean, setClean] = useState(false);
  const [showCleanHint, setShowCleanHint] = useState(false);
  const [recording, setRecording] = useState(false);
  const recordSupported = useSyncExternalStore(noopSubscribe, canRecord, () => false);

  const stage = useRef<StageHandle>(null);
  const recorder = useRef<Recording | null>(null);
  const R = settings.R;

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

  const targetPixels = useMemo(() => (target.status === "ready" ? squarePixels(target.image, R) : null), [target, R]);
  const sourcePixels = useMemo(() => (sourceImage ? squarePixels(sourceImage, R) : null), [sourceImage, R]);
  const colors = useMemo(() => (sourcePixels ? new Uint32Array(sourcePixels.slice().buffer) : null), [sourcePixels]);

  const { dest, progress } = useAssignment(sourcePixels, targetPixels, R, seed);
  const particles = useMemo(
    () => (dest && dest.length === R * R ? buildParticles(dest, R, seed) : null),
    [dest, R, seed],
  );
  const ready = particles !== null;

  const onFile = useCallback(async (file: File) => {
    try {
      setSourceImage(await decodeImage(file));
      setSourceError(null);
    } catch {
      setSourceError(strings.imageLoadFailed);
    }
  }, []);

  // --- recording -----------------------------------------------------------

  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  const finishRecording = useCallback(async () => {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    const blob = await rec.stop();
    setRecording(false);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    downloadBlob(blob, `muhtesem-piksel-${stamp}.webm`);
  }, []);

  const onRecord = useCallback(() => {
    if (recorder.current) {
      void finishRecording();
      return;
    }
    if (!stage.current || !ready) return;
    recorder.current = startRecording(
      () => stage.current?.getFrameCanvas() ?? null,
      () => settingsRef.current.smoothing,
    );
    setRecording(true);
    stage.current.replay();
  }, [finishRecording, ready]);

  const onStatus = useCallback(
    (s: StageStatus) => {
      setStatus(s);
      const atEnd = s.direction === 1 ? s.progress >= 1 : s.progress <= 0;
      if (recorder.current && !s.playing && atEnd) {
        setTimeout(() => void finishRecording(), RECORD_TAIL_MS);
      }
    },
    [finishRecording],
  );

  // A new image / resolution / seed ends any recording in progress.
  useEffect(() => {
    if (recorder.current) void finishRecording();
  }, [particles, finishRecording]);

  // --- keyboard shortcuts ----------------------------------------------------

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) stage.current?.toggle();
      } else if (e.key === "r" || e.key === "R") {
        stage.current?.replay();
      } else if (e.key === "h" || e.key === "H") {
        setClean((c) => {
          setShowCleanHint(!c);
          return !c;
        });
      }
    };
    // Stop Space from also "clicking" a focused button on keyup.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space" && !isTypingTarget(e.target)) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!showCleanHint) return;
    const t = setTimeout(() => setShowCleanHint(false), 1800);
    return () => clearTimeout(t);
  }, [showCleanHint]);

  const stageEl = (
    <PixelStage
      ref={stage}
      R={R}
      particles={particles}
      colors={colors}
      idlePixels={sourcePixels}
      speed={settings.speed}
      dust={settings.dust}
      trails={settings.trails}
      smoothing={settings.smoothing}
      onStatus={onStatus}
    />
  );

  // --- layout ----------------------------------------------------------------

  return (
    <main
      className={
        clean
          ? "flex h-screen items-center justify-center overflow-hidden bg-stage"
          : "mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-6 sm:px-8 sm:py-8"
      }
    >
      {!clean && (
        <header className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4 border-b-[3px] border-ink pb-5">
          <div className="flex flex-col gap-3">
            <h1 className="display text-[clamp(2.5rem,7vw,4.75rem)]">
              {strings.appNameParts[0]}
              <br />
              <span className="inline-block bg-ink px-2 text-paper">{strings.appNameParts[1]}</span>
            </h1>
            <p className="max-w-md text-base font-medium text-ink-soft">{strings.tagline}</p>
          </div>
          <ul className="hidden flex-col gap-2 text-sm font-semibold md:flex">
            {strings.shortcuts.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <kbd className="kbd">{s.key}</kbd>
                <span>{s.action}</span>
              </li>
            ))}
          </ul>
        </header>
      )}

      <div className={clean ? "contents" : "grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]"}>
        <div className={clean ? "contents" : "flex flex-col gap-6"}>
          <div
            className={
              clean
                ? "relative aspect-square w-[min(100vw,100vh)]"
                : "relative aspect-square w-full max-w-[min(100%,calc(100vh-17rem))] border-[3px] border-ink bg-stage shadow-[12px_12px_0_var(--iznik)]"
            }
          >
            {stageEl}
            {clean && showCleanHint && (
              <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
                <span className="border-[3px] border-ink bg-mustard px-3 py-1.5 text-sm font-bold shadow-[4px_4px_0_var(--ink)]">
                  {strings.cleanModeHint}
                </span>
              </div>
            )}
            {!clean && progress !== null && (
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 border-t-[3px] border-ink bg-panel px-4 py-3">
                <span className="text-sm font-bold">{strings.computing}</span>
                <div className="h-4 w-full border-[3px] border-ink bg-paper">
                  <div className="h-full bg-iznik" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </div>
            )}
            {!clean && !sourcePixels && (
              <div className="absolute inset-0 bg-paper p-[8%]">
                <DropZone onFile={onFile} />
              </div>
            )}
          </div>
          {target.status === "error" && (
            <p className="border-[3px] border-ink border-l-[12px] border-l-kaftan bg-panel p-4 text-sm font-semibold">
              {target.message}
            </p>
          )}
          {sourceError && (
            <p className="border-[3px] border-ink border-l-[12px] border-l-kaftan bg-panel p-4 text-sm font-semibold">
              {sourceError}
            </p>
          )}
        </div>

        {clean ? (
          // Keep the drop/paste listeners alive in clean mode too.
          <div className="hidden">
            <DropZone onFile={onFile} compact />
          </div>
        ) : (
          <aside className="flex flex-col gap-6">
            <Controls
              ready={ready}
              playing={status.playing}
              direction={status.direction}
              recording={recording}
              canRecord={recordSupported}
              seed={seed}
              settings={settings}
              onSettings={(patch) => setSettings((s) => ({ ...s, ...patch }))}
              onToggle={() => stage.current?.toggle()}
              onReplay={() => stage.current?.replay()}
              onReverse={() => stage.current?.reverse()}
              onShowEnd={() => stage.current?.showEnd()}
              onNewSeed={() => setSeed(randomSeed())}
              onRecord={onRecord}
            >
              <DropZone onFile={onFile} compact />
            </Controls>

            <div className="grid grid-cols-2 gap-5">
              <PixelPreview label={strings.sourceLabel} pixels={sourcePixels} R={R}>
                {strings.dropTitle}
              </PixelPreview>
              <PixelPreview label={strings.targetLabel} pixels={targetPixels} R={R}>
                {target.status === "loading" ? strings.targetLoading : target.status === "error" ? "—" : null}
              </PixelPreview>
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
