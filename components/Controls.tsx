"use client";

import { strings } from "@/lib/strings";

type Props = {
  ready: boolean;
  playing: boolean;
  onToggle: () => void;
  onReplay: () => void;
  onShowEnd: () => void;
  children?: React.ReactNode;
};

export default function Controls({ ready, playing, onToggle, onReplay, onShowEnd, children }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" className="btn btn-primary min-w-20" disabled={!ready} onClick={onToggle}>
        {playing ? strings.pause : strings.play}
      </button>
      <button type="button" className="btn" disabled={!ready} onClick={onReplay}>
        {strings.replay}
      </button>
      <button type="button" className="btn" disabled={!ready} onClick={onShowEnd}>
        {strings.showResult}
      </button>
      {children}
    </div>
  );
}
