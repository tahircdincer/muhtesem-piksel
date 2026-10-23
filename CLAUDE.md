# MuhteşemPiksel

A local web app that takes **any image** and rearranges its own pixels, with a Thanos-dust-style animation, until they form a fixed **target image** (`sehzademustafa.png` or `sehzademustafa.jpeg`).

The idea: every image already contains the target's face, you just have to move the pixels to the right places.

> Naming: the display name is **MuhteşemPiksel** (use it in the UI, README, page title). The folder name, package name and repo name must be ASCII: `muhtesem-piksel`. Do not put `ş` in file paths or `package.json`.

---

## The one rule that defines this project

**The output is a permutation of the input pixels.**

- Every pixel in the final image is an original pixel from the uploaded image, with its exact original color.
- Every input pixel is used exactly once. No pixel is duplicated, dropped, blended, tinted or generated.
- Never resample, blur, color-correct or interpolate colors after the assignment step.
- Colors are allowed to look "wrong" for the target (a blue photo gives a blue-tinted face). That is the point and matches the intended look.

Add a test that enforces this (see Testing).

---

## What it does (user-visible behavior)

1. App loads, fetches the target image from the project folder, shows it as a small preview.
2. User provides a source image by drag and drop, file picker, or clipboard paste.
3. App computes, for every source pixel, the target position it should move to (runs in a Web Worker, shows a progress bar).
4. User presses Play. Each pixel detaches and travels to its destination with a dust-like disintegrate-and-drift motion. The final frame is the target image built entirely from source pixels.
5. User can replay, reverse, change speed, re-roll the random seed, or load another image.

Reference look (from the video the project is based on): a square window, the source image dissolving into a grainy, smeared cloud of its own colors mid-animation, then settling into the target face tinted by the source image's palette.

---

## Tech stack

- Next.js (latest stable, App Router), TypeScript (strict), Tailwind
- HTML Canvas 2D for rendering. No WebGL in v1.
- Web Worker for the assignment step
- Vitest for unit tests
- No backend processing, no database, no external APIs. Everything runs locally in the browser.
- Package manager: npm unless the repo already uses something else.

## Target image handling

- The user places `sehzademustafa.png` **or** `sehzademustafa.jpeg` (also accept `.jpg`) in the **project root**.
- `app/api/target/route.ts` checks for those filenames in order (png, jpeg, jpg), returns the file bytes with the correct `Content-Type`, and returns a 404 with a clear message if none exists. The UI must show that message instead of crashing.
- Do not copy the target into `public/` and do not commit it by default (add it to `.gitignore` with a comment so the user can change that).

## Project structure

```
muhtesem-piksel/
  CLAUDE.md
  sehzademustafa.png | .jpeg        (provided by the user)
  app/
    layout.tsx
    page.tsx
    api/target/route.ts
  components/
    PixelStage.tsx        canvas + animation loop
    Controls.tsx          play, reverse, speed, seed, resolution, dust, trails
    DropZone.tsx          drag/drop, picker, paste
  lib/
    image.ts              load, center-crop to square, resample to R×R, read RGBA
    color.ts              sRGB -> OKLab, color distance
    assign.ts             pixel assignment (rank init + swap refinement)
    assign.worker.ts      runs assign.ts off the main thread
    animate.ts            per-particle timing and path math
    rng.ts                seeded RNG (mulberry32 or similar)
    record.ts             canvas recording (phase 6)
    strings.ts            ALL UI text lives here
  tests/
    assign.test.ts
    animate.test.ts
```

---

## Core algorithm

### 1. Prepare both images

- Center-crop each image to a square, resample to `R × R` (default `R = 256`, selectable 128 / 192 / 256 / 384).
- Source and target must have identical `R` so pixel counts match: `N = R × R`.
- Flatten transparency onto black. Ignore alpha after that.
- Store pixels in typed arrays (`Uint8ClampedArray` RGBA, plus `Float32Array` OKLab).

### 2. Assignment: where does each source pixel go?

Output: `dest: Uint32Array(N)` where `dest[i]` is the target index that source pixel `i` moves to. It must be a valid permutation.

**Step A, rank matching (fast baseline, must work on its own):**
Sort source pixels by OKLab lightness. Sort target pixels by OKLab lightness. Match the k-th darkest source pixel to the k-th darkest target pixel. This already reproduces the target's light/dark structure using the source's colors.

**Step B, swap refinement (quality pass):**
Repeatedly pick two random source pixels `i` and `j` with destinations `a = dest[i]` and `b = dest[j]`. Compare:

```
cost(i→a) + cost(j→b)   vs   cost(i→b) + cost(j→a)
cost(i→t) = colorDist(source[i], target[t]) + λ * spatialDist(pos(i), pos(t))
```

Swap if the swapped total is lower. `colorDist` is Euclidean distance in OKLab. `spatialDist` is pixel distance normalized by `R`. The `λ` term keeps movement coherent so the animation looks like a flow instead of total chaos.

- Start with `λ = 0.15`, expose it as a constant, tune by eye.
- Iteration budget: `N * 64` attempts, capped at about 3 seconds of wall time. Post progress to the main thread roughly every 2%.
- Hot loop must use typed arrays only: no object allocation, no array methods.

Do Step A first and verify it. Add Step B only after the baseline works end to end.

### 3. Animation

Each particle `i` starts at its source position and ends at the position of `dest[i]`.

Per particle, precompute once (seeded, so replays are identical):

- `delay`: when it detaches. Based on a sweeping front (for example left to right with a diagonal tilt) mixed with 2D value noise, so the image crumbles in a wave instead of all at once.
- `duration`: base duration with random jitter.
- `curl`: signed amplitude for a sideways arc.
- `drift`: small wind vector (slightly upward, like ash).

Position at progress `t` in `[0, 1]` (after applying delay and duration):

```
base  = lerp(start, end, easeInOutCubic(t))
arc   = perpendicular(end - start) * curl * sin(π t) * dustIntensity
wind  = drift * sin(π t) * dustIntensity
pos   = base + arc + wind + jitter(t) * dustIntensity
```

- `arc`, `wind` and `jitter` all go to zero at `t = 1`. **The last frame must land every particle on its exact integer target position.** Add a test.
- Before its delay a particle sits still at its source position.
- Total default runtime about 6 seconds, adjustable with a speed slider.

### 4. Rendering

- Internal buffer is `R × R`. Each frame: clear to background, write each particle's color at `round(pos)` into a `Uint32Array` view, `putImageData` to an offscreen canvas, then `drawImage` scaled to the visible canvas.
- Particles mid-flight leave small gaps. That graininess is part of the dust look, do not fill them.
- Optional **trails** toggle: instead of a full clear, fade the previous frame (low-alpha dark fill) to get the smeared cloud look.
- Visible canvas is square, sized to fit the viewport. `imageSmoothingEnabled` is a toggle, default on.
- Use `requestAnimationFrame` and drive animation from elapsed time, not frame count.

---

## UI

- Dark, minimal, centered square stage. Looks good when screen-recorded.
- Controls: Play / Pause, Replay, Reverse, Speed, Dust intensity, Trails toggle, Resolution, New seed, Load image.
- **Clean mode**: press `H` to hide all controls and chrome so only the stage is visible (for recording). Press `H` again to bring them back.
- Show the progress bar while assignment is running. Disable Play until it finishes.
- All text comes from `lib/strings.ts`. Default language English, structured so a Turkish version is a one-file swap.

---

## Build order (do these in sequence, stop and confirm after each)

**Phase 0, scaffold.** Next.js + TypeScript + Tailwind project, `.gitignore` entry for the target image, `lib/strings.ts`, empty page renders with the title MuhteşemPiksel.
Done when: `npm run dev` shows the page.

**Phase 1, images.** `api/target` route, `lib/image.ts`, DropZone. Show the cropped square source and target side by side.
Done when: both images appear at `R × R` after drop, and a missing target shows a friendly error.

**Phase 2, assignment baseline.** `color.ts`, rank matching in `assign.ts`, Vitest tests. Add a debug button that instantly renders the permuted result with no animation.
Done when: the debug render shows a recognizable target made of source colors, and the permutation tests pass.

**Phase 3, animation.** `rng.ts`, `animate.ts`, `PixelStage.tsx`. Play, pause, replay.
Done when: the full transition plays and the last frame equals the debug render from Phase 2 exactly.

**Phase 4, worker and refinement.** Move assignment into `assign.worker.ts`, add progress reporting, add swap refinement.
Done when: the UI stays responsive during compute and the refined result has lower total cost than the baseline (test it).

**Phase 5, controls and polish.** Speed, dust, trails, reverse, seed, resolution, clean mode, paste support, keyboard shortcuts (Space play/pause, R replay, H clean mode).

**Phase 6, recording (nice to have).** `record.ts`: a Record button that captures the stage with `canvas.captureStream(60)` and `MediaRecorder` at 1080×1080, auto-stops about 1 second after the animation ends, then downloads a `.webm`.
Premiere Pro does not import `.webm` reliably, so add a README note with the conversion command:
`ffmpeg -i input.webm -c:v libx264 -pix_fmt yuv420p output.mp4`

---

## Testing

Run with `npm test`. Required tests:

1. **Valid permutation:** `dest` contains every index `0..N-1` exactly once.
2. **Colors preserved:** the multiset of output pixel colors equals the multiset of source pixel colors.
3. **Refinement helps:** total cost after swap refinement is lower than rank-matching alone (fixed seed, small `R` like 32).
4. **Exact landing:** at `t = 1` every particle's position equals its target position exactly.
5. **Determinism:** same inputs and seed produce identical `dest` and identical animation frames.

Use small synthetic images (gradients, noise) in tests. Do not depend on the real target file.

---

## Conventions

- TypeScript strict, no `any`.
- Pure logic (`assign`, `animate`, `color`, `rng`) must not touch the DOM so it is testable and workable in a worker.
- Hot loops use typed arrays, no allocations per frame.
- Keep components small. No new dependencies without a reason written in the commit message.
- Never add network calls. The app must work fully offline.
- Commit after each phase with a clear message.

## Assumptions to verify

These came from a script and three screenshots of the original video, so internals are inferred, not known:

- The original appears to be a native desktop window; this version is a browser app by choice.
- The exact assignment method of the original is unknown. The rank-plus-swap approach here is our own design.
- Dust timing, sweep direction and trail look are matched by eye to the screenshots. Expect to tune the defaults.
- Output resolution of the original is unknown. `R = 256` is a starting point.

Tell me if any of these turn out to be wrong, rather than working around them silently.
