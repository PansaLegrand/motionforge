# Examples

Scene documents that produce real videos. Render any of them with:

```sh
pnpm --filter @motionforge/golden exec playwright install chromium  # once
pnpm --filter @motionforge/golden run example examples/tiktok-captions.json out.mp4 60
```

The trailing numbers are optional frame indices written as PNGs next to the MP4.

## tiktok-captions.json

The one-word-at-a-time caption style (1080x1920, 30 fps, 5 s): each word is a
text node with `from`/`duration` timing, a `fontSize` pop with `easeOut`,
opacity fade-in, highlight pills behind emphasized words, a color keyframe
(white → gold) on the last word, an animated progress bar, and an SVG image
asset — all from one JSON document, no code.

| frame 30                             | frame 60                             | frame 135                              |
| ------------------------------------ | ------------------------------------ | -------------------------------------- |
| ![frame 30](tiktok-captions-f30.png) | ![frame 60](tiktok-captions-f60.png) | ![frame 135](tiktok-captions-f135.png) |
