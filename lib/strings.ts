// All UI text lives here. To translate, replace the values in this file
// (keep the keys). Turkish is a one-file swap.

export const strings = {
  appName: "MuhteşemPiksel",
  tagline: "Every image already contains the face. Move the pixels.",
  description:
    "Rearranges the pixels of any image into a fixed target image.",

  sourceLabel: "Source",
  targetLabel: "Target",
  resultLabel: "Result",

  targetLoading: "Loading target image…",
  targetMissing:
    "No target image found. Put sehzademustafa.png, sehzademustafa.jpeg or sehzademustafa.jpg in the project root and reload.",
  targetLoadFailed: "Could not load the target image.",

  dropTitle: "Drop an image here",
  dropHint: "or click to choose a file, or paste with Ctrl/Cmd+V",
  dropActive: "Release to load",
  imageLoadFailed: "That file could not be read as an image.",

  computing: "Arranging pixels…",
  computeDone: "Ready",

  play: "Play",
  pause: "Pause",
  replay: "Replay",
  reverse: "Reverse",
  forward: "Forward",
  speed: "Speed",
  dust: "Dust",
  trails: "Trails",
  smoothing: "Smoothing",
  resolution: "Resolution",
  newSeed: "New seed",
  seed: "Seed",
  loadImage: "Load image",
  showResult: "Show result",
  record: "Record",
  recording: "Recording…",
  recordUnsupported: "Recording is not supported in this browser.",

  shortcuts: "Space play/pause · R replay · H hide controls",
  cleanModeHint: "Press H to show controls",
} as const;

export type Strings = typeof strings;
