# MuhteşemPiksel

Takes any image and rearranges **its own pixels**, with a dust-like animation, until they form a fixed target image. Nothing is generated or blended: the final frame is a permutation of the input pixels, with their exact original colors.

Everything runs locally in the browser. No network calls, no backend processing.

## Setup

1. Put the target image in the project root as `sehzademustafa.png`, `sehzademustafa.jpeg` or `sehzademustafa.jpg` (checked in that order). It is gitignored by default; remove the lines in `.gitignore` if you want to commit it.
2. Install and run:

```sh
npm install
npm run dev
```

3. Open http://localhost:3000 and drop an image onto the page, click to choose a file, or paste one with Ctrl/Cmd+V.

## Controls

The interface is in Turkish. All UI text lives in `lib/strings.ts`; replace its values to switch language.

| Control | What it does |
| --- | --- |
| Oynat / Duraklat | Start or pause the transition (Space) |
| Baştan | Restart from the beginning (R) |
| Geri oynat | Flip direction and play back toward the source image |
| Sonucu göster | Jump straight to the finished target image |
| Kaydet | Record the transition to a 1080×1080 `.webm` (stops about 1 s after the end; click again to stop early) |
| Hız | 0.25× to 3× (6 s at 1×) |
| Toz | Strength of the arc, wind and jitter. 0 = straight lines |
| İz bırak | Fade the previous frame instead of clearing, for a smeared cloud look |
| Yumuşatma | Smooth or pixelated upscaling of the stage |
| Çözünürlük | 128, 192, 256 or 384 pixels square |
| Yeni tohum | Re-roll the random seed (changes both the assignment and the motion) |
| H | Clean mode: hide everything but the stage, for screen recording |

## Converting recordings for Premiere Pro

Premiere does not import `.webm` reliably. Convert with ffmpeg:

```sh
ffmpeg -i input.webm -c:v libx264 -pix_fmt yuv420p output.mp4
```

## How it works

1. Both images are center-cropped to a square and resampled to R×R (this is the only resampling step).
2. **Rank matching:** source and target pixels are each sorted by OKLab lightness, and the k-th darkest source pixel goes to the k-th darkest target position.
3. **Swap refinement** (in a Web Worker): random pairs of source pixels swap destinations when that lowers `colorDist + λ · spatialDist`. The spatial term keeps the motion coherent. Capped at N×64 attempts or about 3 seconds.
4. **Animation:** each pixel detaches along a noisy sweeping front, travels on an eased path with a sideways arc, upward drift and jitter, and lands exactly on its integer target position.

Tunable constants: `LAMBDA` and friends in `lib/assign.ts`, timing and motion constants in `lib/animate.ts`. All UI text lives in `lib/strings.ts`.

## Scripts

- `npm run dev`: dev server
- `npm test`: unit tests (permutation validity, color preservation, refinement lowers cost, exact landing, determinism)
- `npm run build`: production build
