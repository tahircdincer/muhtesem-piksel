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
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-paper/85">
      <div className="display border-[3px] border-ink bg-mustard px-10 py-8 text-3xl shadow-[8px_8px_0_var(--ink)]">
        {strings.dropActive}
      </div>
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
        className="flex h-full w-full flex-col items-center justify-center gap-3 border-[3px] border-dashed border-ink bg-panel p-6 text-center hover:bg-mustard"
      >
        <span className="display text-2xl sm:text-3xl">{strings.dropTitle}</span>
        <span className="max-w-xs text-sm font-medium text-ink-soft">{strings.dropHint}</span>
      </button>
    </>
  );
}
