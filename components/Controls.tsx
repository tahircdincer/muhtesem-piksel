"use client";

import { RESOLUTIONS, type Resolution } from "@/lib/image";
import { strings } from "@/lib/strings";

export type Settings = {
  speed: number;
  dust: number;
  trails: boolean;
  smoothing: boolean;
  R: Resolution;
};

type Props = {
  ready: boolean;
  playing: boolean;
  direction: 1 | -1;
  recording: boolean;
  canRecord: boolean;
  seed: number;
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => void;
  onToggle: () => void;
  onReplay: () => void;
  onReverse: () => void;
  onShowEnd: () => void;
  onNewSeed: () => void;
  onRecord: () => void;
  /** Rendered at the end of the second row (the Load image button). */
  children?: React.ReactNode;
};

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <span>{props.label}</span>
      <input
        type="range"
        className="w-24"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
      />
      <span className="w-10 tabular-nums text-foreground">{props.format(props.value)}</span>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} className={`btn ${on ? "btn-on" : ""}`} onClick={() => onChange(!on)}>
      {label}
    </button>
  );
}

export default function Controls(p: Props) {
  const { settings: s, onSettings } = p;
  return (
    <div className="flex w-full max-w-3xl flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" className="btn btn-primary min-w-20" disabled={!p.ready} onClick={p.onToggle}>
          {p.playing ? strings.pause : strings.play}
        </button>
        <button type="button" className="btn" disabled={!p.ready} onClick={p.onReplay}>
          {strings.replay}
        </button>
        <button type="button" className={`btn ${p.direction === -1 ? "btn-on" : ""}`} disabled={!p.ready} onClick={p.onReverse}>
          {p.direction === 1 ? strings.reverse : strings.forward}
        </button>
        <button type="button" className="btn" disabled={!p.ready} onClick={p.onShowEnd}>
          {strings.showResult}
        </button>
        <button
          type="button"
          className={`btn ${p.recording ? "border-red-500/70 text-red-400" : ""}`}
          disabled={!p.ready || !p.canRecord}
          title={p.canRecord ? undefined : strings.recordUnsupported}
          onClick={p.onRecord}
        >
          <span className={`inline-block size-2 rounded-full ${p.recording ? "animate-pulse bg-red-500" : "bg-red-500/70"}`} />
          {p.recording ? strings.recording : strings.record}
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <Slider
          label={strings.speed}
          value={s.speed}
          min={0.25}
          max={3}
          step={0.05}
          format={(v) => `${v.toFixed(2)}×`}
          onChange={(speed) => onSettings({ speed })}
        />
        <Slider
          label={strings.dust}
          value={s.dust}
          min={0}
          max={2}
          step={0.05}
          format={(v) => v.toFixed(2)}
          onChange={(dust) => onSettings({ dust })}
        />
        <Toggle label={strings.trails} on={s.trails} onChange={(trails) => onSettings({ trails })} />
        <Toggle label={strings.smoothing} on={s.smoothing} onChange={(smoothing) => onSettings({ smoothing })} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-muted">{strings.resolution}</span>
        <div className="flex">
          {RESOLUTIONS.map((r, i) => (
            <button
              key={r}
              type="button"
              aria-pressed={s.R === r}
              className={`btn rounded-none tabular-nums ${i === 0 ? "rounded-l-md" : "-ml-px"} ${
                i === RESOLUTIONS.length - 1 ? "rounded-r-md" : ""
              } ${s.R === r ? "btn-on relative z-10" : ""}`}
              disabled={p.recording}
              onClick={() => onSettings({ R: r })}
            >
              {r}
            </button>
          ))}
        </div>
        <button type="button" className="btn" disabled={p.recording} onClick={p.onNewSeed} title={`${strings.seed} ${p.seed}`}>
          {strings.newSeed}
          <span className="font-mono text-[10px] text-muted">#{p.seed.toString(16).padStart(8, "0").slice(0, 6)}</span>
        </button>
        {p.children}
      </div>
    </div>
  );
}
