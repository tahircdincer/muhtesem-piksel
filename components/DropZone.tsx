"use client";

import { useEffect, useRef, useState } from "react";
import { strings } from "@/lib/strings";

type Props = {
  onFile: (file: File) => void;
  /** Compact = a single "Load image" button instead of the big drop area. */
  compact?: boolean;
};

function firstImage(list: FileList | DataTransferItemList | null | undefined): File | null {
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    const file = entry instanceof File ? entry : entry.kind === "file" ? entry.getAsFile() : null;
    if (file && file.type.startsWith("image/")) return file;
  }
  return null;
}

/**
 * Accepts an image by drag and drop (anywhere on the window),
 * file picker, or clipboard paste.
 */
export default function DropZone({ onFile, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const onFileRef = useRef(onFile);
  useEffect(() => {
    onFileRef.current = onFile;
  }, [onFile]);

  useEffect(() => {
    let depth = 0;
    const onDragEnter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      depth++;
      setDragging(true);
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const onDragLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = firstImage(e.dataTransfer?.files);
      if (file) onFileRef.current(file);
    };
    const onPaste = (e: ClipboardEvent) => {
      const file = firstImage(e.clipboardData?.items);
      if (file) {
        e.preventDefault();
        onFileRef.current(file);
      }
    };
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        const file = firstImage(e.currentTarget.files);
        if (file) onFile(file);
        e.currentTarget.value = "";
      }}
    />
  );

  const overlay = dragging ? (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-lg text-foreground">
      <div className="rounded-xl border-2 border-dashed border-accent px-10 py-8">{strings.dropActive}</div>
    </div>
  ) : null;

  if (compact) {
    return (
      <>
        {input}
        {overlay}
        <button type="button" className="btn" onClick={() => inputRef.current?.click()}>
          {strings.loadImage}
        </button>
      </>
    );
  }

  return (
    <>
      {input}
      {overlay}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-panel/60 p-6 text-center transition-colors hover:border-accent"
      >
        <span className="text-base">{strings.dropTitle}</span>
        <span className="text-xs text-muted">{strings.dropHint}</span>
      </button>
    </>
  );
}
