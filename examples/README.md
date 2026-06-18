# Examples

Scene documents that produce real videos. Render any of them with:

```sh
pnpm build
pnpm showcase:generate
pnpm --filter @motionforge/golden exec playwright install chromium  # once
pnpm --filter @motionforge/golden run example examples/generated/tiktok-captions.json out.mp4 60
```

The trailing numbers are optional frame indices written as PNGs next to the MP4.

## generated/

`examples/generated/*.json` is produced from the shared showcase scenes:

```sh
pnpm showcase:generate
```

Those scenes also power the playground scene picker, so docs, examples, and preview stay aligned.

`examples/generated/presets/*.json` is produced from the preset gallery scene generator:

```sh
pnpm build
pnpm presets:generate
```

Render the docs thumbnails with the browser golden harness:

```sh
mkdir -p docs/assets/presets
pnpm --filter @motionforge/golden run example examples/generated/presets/preset-subtitles.json docs/assets/presets/preset-subtitles.mp4 45
pnpm --filter @motionforge/golden run example examples/generated/presets/preset-text-overlays.json docs/assets/presets/preset-text-overlays.mp4 45
pnpm --filter @motionforge/golden run example examples/generated/presets/preset-media-looks.json docs/assets/presets/preset-media-looks.mp4 45
pnpm --filter @motionforge/golden run example examples/generated/presets/preset-clip-layouts.json docs/assets/presets/preset-clip-layouts.mp4 45
pnpm --filter @motionforge/golden run example examples/generated/presets/preset-transitions.json docs/assets/presets/preset-transitions.mp4 30
```

The PNG frames are committed for docs. The intermediate MP4 files are ignored.

## Prompt-style examples

The generated showcase now includes two use-case demos aimed at agent and editor workflows:

- `launch-info-display.json` — a prompt-to-video style launch display with animated panels, scan lines, countdown text, and progress motion.
- `timed-text-overlay.json` — a written timing prompt mapped to frame-accurate overlays: `motionforge.dev` at top center for the first 5 seconds, then `Coming soon...` in the bottom-right corner for the final 10 seconds.
- `text-stress-gallery.json` — long Latin, URLs, CJK, emoji, long single-token text, and multiline captions in bounded overlay cards.

These examples prove the scene contract is ready for prompt-generated videos. The repository does not yet ship a natural-language compiler; today an agent, app, or preset layer writes the scene JSON and motionforge validates, previews, and exports it.

Render the text stress gallery when changing text layout or renderer behavior:

```sh
pnpm build
pnpm showcase:generate
pnpm --filter @motionforge/golden run example examples/generated/text-stress-gallery.json out/text-stress-gallery.mp4 30
```

## tiktok-captions.json

The one-word-at-a-time caption style (1080x1920, 30 fps, 5 s): each word is a
text node with `from`/`duration` timing, a `fontSize` pop with `easeOut`,
opacity fade-in, highlight pills behind emphasized words, a color keyframe
(white → gold) on the last word, an animated progress bar, and an SVG image
asset — all from one JSON document, no code.

| frame 30                             | frame 60                             | frame 135                              |
| ------------------------------------ | ------------------------------------ | -------------------------------------- |
| ![frame 30](tiktok-captions-f30.png) | ![frame 60](tiktok-captions-f60.png) | ![frame 135](tiktok-captions-f135.png) |

## generate-tiktok.mjs

The same caption track, generated instead of hand-written: one
`tiktokCaptions(words, { fps, highlightIndices })` call from
[`@motionforge/presets`](../packages/presets) replaces ~300 lines of JSON.
The generated version uses renderer-measured text pills (`textBackgroundColor`
and padding/radius on text nodes) instead of hand-sized wrapper boxes.

```sh
pnpm build
node examples/generate-tiktok.mjs > /tmp/tiktok-presets.json
pnpm --filter @motionforge/golden run example /tmp/tiktok-presets.json out.mp4 50
```
