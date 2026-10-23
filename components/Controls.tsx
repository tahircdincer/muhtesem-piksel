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
  /** Rendered in the image block (the Load image button). */
  children?: React.ReactNode;
};

const formatNumber = (v: number) => v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="slab flex flex-col gap-3 p-4">
      <h2 className="text-sm font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

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
    <label className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-sm font-semibold">
      <span>{props.label}</span>
      <input
        type="range"
        className="w-full"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.currentTarget.value))}
      />
      <span className="text-right tabular-nums">{props.format(props.value)}</span>
    </label>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} className={`btn flex-1 ${on ? "btn-on" : ""}`} onClick={() => onChange(!on)}>
      <span aria-hidden className={`size-3 border-2 border-ink ${on ? "bg-ink" : "bg-panel"}`} />
      {label}
    </button>
  );
}

export default function Controls(p: Props) {
  const { settings: s, onSettings } = p;
  return (
    <div className="flex w-full flex-col gap-5">
      <Group title={strings.playback}>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="btn btn-primary col-span-2 h-12 text-base" disabled={!p.ready} onClick={p.onToggle}>
            {p.playing ? strings.pause : strings.play}
          </button>
          <button type="button" className="btn" disabled={!p.ready} onClick={p.onReplay}>
            {strings.replay}
          </button>
          <button
            type="button"
            aria-pressed={p.direction === -1}
            className={`btn ${p.direction === -1 ? "btn-on" : ""}`}
            disabled={!p.ready}
            onClick={p.onReverse}
          >
            {p.direction === 1 ? strings.reverse : strings.forward}
          </button>
          <button type="button" className="btn" disabled={!p.ready} onClick={p.onShowEnd}>
            {strings.showResult}
          </button>
          <button
            type="button"
            className={`btn ${p.recording ? "btn-record" : ""}`}
            disabled={!p.ready || !p.canRecord}
            title={p.canRecord ? undefined : strings.recordUnsupported}
            onClick={p.onRecord}
          >
            <span
              aria-hidden
              className={`size-3 rounded-full border-2 border-ink ${p.recording ? "animate-pulse bg-panel" : "bg-kaftan"}`}
            />
            {p.recording ? strings.recording : strings.record}
          </button>
        </div>
        <Slider
          label={strings.speed}
          value={s.speed}
          min={0.25}
          max={3}
          step={0.05}
          format={(v) => `${formatNumber(v)}×`}
          onChange={(speed) => onSettings({ speed })}
        />
      </Group>

      <Group title={strings.look}>
        <Slider
          label={strings.dust}
          value={s.dust}
          min={0}
          max={2}
          step={0.05}
          format={formatNumber}
          onChange={(dust) => onSettings({ dust })}
        />
        <div className="flex gap-3">
          <Toggle label={strings.trails} on={s.trails} onChange={(trails) => onSettings({ trails })} />
          <Toggle label={strings.smoothing} on={s.smoothing} onChange={(smoothing) => onSettings({ smoothing })} />
        </div>
      </Group>

      <Group title={strings.image}>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{strings.resolution}</span>
          <div className="grid grid-cols-4 border-[3px] border-ink shadow-[4px_4px_0_var(--ink)]">
            {RESOLUTIONS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={s.R === r}
                className={`h-10 border-ink text-sm font-bold tabular-nums not-last:border-r-[3px] disabled:cursor-not-allowed disabled:opacity-55 ${
                  s.R === r ? "bg-ink text-panel" : "bg-panel hover:bg-mustard"
                }`}
                disabled={p.recording}
                onClick={() => onSettings({ R: r })}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button type="button" className="btn" disabled={p.recording} onClick={p.onNewSeed} title={`${strings.seed}: ${p.seed}`}>
            {strings.newSeed}
          </button>
          {p.children}
        </div>
      </Group>
    </div>
  );
}
