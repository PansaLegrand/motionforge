# Authoring API

`@motionforge/authoring` is the high-level TypeScript layer. It reduces boilerplate but still emits the same validated MotionForge scene JSON.

## Scene

```ts
import { frames, makeScene, seconds, toFrames, toSeconds } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [],
});
```

`size` accepts:

- `"portrait"` -> `1080x1920`
- `"landscape"` -> `1920x1080`
- `"square"` -> `1080x1080`
- `{ width, height }`

Timing helpers:

```ts
seconds(2.5)
frames(75)
toFrames(seconds(2.5), 30) // 75
toSeconds(frames(75), 30)  // 2.5
```

Bare numbers are not timing values. Use `seconds()` for readability or `frames()` for exact control.

## Visual Nodes

```ts
bg("#0f172a")

title("Launch Week", {
  at: seconds(0.5),
  duration: seconds(3),
  enter: fadeUp(),
})

textBlock("Three updates. One clean video.", {
  at: seconds(1.2),
  style: { top: 980, color: "#cbd5e1" },
})

box({
  id: "card",
  at: seconds(1),
  style: {
    left: 96,
    top: 360,
    width: 888,
    height: 420,
    backgroundColor: "#ffffff",
    borderRadius: 28,
  },
})
```

Every helper accepts `id`, `at`, `duration`, and most visual helpers accept `style` and `enter`.

## Robust Text Overlays

Use `textBox()` when copy may come from users, chat instructions, CSV rows, or any other source where the final length is not known ahead of time. It emits ordinary text nodes with bounded dimensions, `textFit`, `maxLines`, `minFontSize`, and ellipsis behavior already set.

```ts
import { bg, makeScene, seconds, textBox } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  duration: seconds(6),
  children: [
    bg("#111827"),
    textBox("Launch Week: every update in under one minute", {
      id: "headline",
      placement: "title",
      maxLines: 2,
    }),
    textBox("I love this", {
      id: "subtitle",
      placement: "subtitle",
      fit: "shrink",
      minFontSize: 24,
    }),
    textBox("Ada Chen\nProduct Lead", {
      id: "speaker",
      placement: "lowerThird",
      safeArea: { x: 96, y: 120 },
    }),
    textBox("42%", {
      id: "stat",
      placement: "statCallout",
      maxLines: 1,
      style: { color: "#fde68a" },
    }),
  ],
});
```

`placement` accepts `"center"`, `"top"`, `"bottom"`, `"title"`, `"subtitle"`, `"lowerThird"`, and `"statCallout"`. `safeArea` defaults to the named profile inferred from composition aspect ratio: `"vertical"`, `"square"`, or `"landscape"`. Pass one of those names, a number for equal padding, `{ x, y }` for axis padding, edge-specific values, or `false` for full-frame placement.

When you need the placement box without creating a text node, use the same primitives directly:

```ts
import { resolveSafeArea, safeAreaBox } from "@motionforge/authoring";

const size = { width: 1080, height: 1920 };

resolveSafeArea(size, "vertical");
safeAreaBox(size, "lowerThird", { widthRatio: 0.72 });
```

The defaults are intentionally production-safe:

- `fit: "shrink"` keeps long text inside the box.
- `textOverflow: "ellipsis"` preserves a visible ending when text is clamped.
- `overflow: "hidden"` prevents accidental bleed into neighboring overlays.
- `style` remains an escape hatch and overrides all generated defaults.

## Media Nodes

```ts
import {
  audioAsset,
  audioTrack,
  image,
  imageAsset,
  makeScene,
  publicAsset,
  seconds,
  videoAsset,
  videoClip,
} from "@motionforge/authoring";

const poster = imageAsset("poster", publicAsset("assets/poster.png"));
const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));
const music = audioAsset("music", publicAsset("assets/music.mp3"));

makeScene({
  size: "landscape",
  duration: seconds(8),
  children: [
    image(poster),
    videoClip(clip, {
      at: seconds(1),
      duration: seconds(4),
      trimStart: seconds(5),
      playbackRate: 1.25,
      volume: 0.5,
    }),
    audioTrack(music, {
      duration: seconds(8),
      volume: 0.25,
    }),
  ],
});
```

Passing an asset object to `image()`, `videoClip()`, or `audioTrack()` auto-adds it to `scene.assets`. You can also pass a string asset id when assets are defined elsewhere:

```ts
import {
  defineAssets,
  makeScene,
  seconds,
  videoAsset,
  videoClip,
} from "@motionforge/authoring";

makeScene({
  size: "landscape",
  duration: seconds(8),
  assets: defineAssets(videoAsset("clip", "/assets/clip.mp4")),
  children: [videoClip("clip", { duration: seconds(4) })],
});
```

## Escape Hatch

The lower-level packages remain available when you need exact control:

```ts
import { composition, div, text } from "@motionforge/core";

const scene = composition({ width: 1080, height: 1920, fps: 30, duration: 90 })
  .children(
    div({ style: { width: "100%", height: "100%", backgroundColor: "#111827" } }),
    text("Hello", {
      style: {
        position: "absolute",
        left: 64,
        top: 720,
        fontSize: 96,
        color: "#fff",
      },
    }),
  )
  .toJSON();
```

Use the [scene format](../scene-format.md) when you need the complete property matrix.
