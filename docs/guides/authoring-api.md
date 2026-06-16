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
