# @motionforge/authoring

Seconds-first TypeScript helpers for writing MotionForge scenes with less boilerplate.

This package is intentionally small. It does not replace the scene schema or lower-level builder; it compiles author-friendly options into the same validated MotionForge `Scene` JSON.

## Install

```sh
npm install @motionforge/authoring
```

## Usage

```ts
import {
  bg,
  fadeUp,
  makeScene,
  seconds,
  textBlock,
  title,
} from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#0f172a"),
    title("Hello MotionForge", {
      at: seconds(0.8),
      enter: fadeUp(),
    }),
    textBlock("Deterministic video as TypeScript data.", {
      at: seconds(1.4),
      duration: seconds(2.8),
      enter: fadeUp({ delay: 6 }),
    }),
  ],
});
```

`makeScene()` returns a normal MotionForge scene document. Store it, diff it, validate it, patch it, preview it, or export it with the existing MotionForge packages.

## Timing

Use seconds in authoring code and let the package compile to integer frames:

```ts
seconds(2.5)        // authoring time value
toFrames(seconds(2.5), 30) // 75
frames(12)          // explicit frame value
```

Bare numbers are intentionally not accepted as timing values. Use `seconds(n)` for authoring readability or `frames(n)` when you need exact frame control.

## Media

Put local media files in your project's `public/assets` directory. Vite serves files from `public` at the site root, so `public/assets/clip.mp4` is referenced as `/assets/clip.mp4`.

```ts
import {
  image,
  imageAsset,
  makeScene,
  publicAsset,
  seconds,
  videoAsset,
  videoClip,
} from "@motionforge/authoring";

const logo = imageAsset("logo", publicAsset("assets/logo.png"));
const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));

export default makeScene({
  size: "landscape",
  fps: 30,
  duration: seconds(5),
  children: [
    image(logo, { duration: seconds(5) }),
    videoClip(clip, {
      trimStart: seconds(5),
      duration: seconds(5),
    }),
  ],
});
```

`publicAsset()` normalizes local public-folder paths and leaves absolute URLs alone. The emitted scene JSON still contains explicit asset entries and fetchable `src` strings; there is no hidden resolver.

You can still pass an existing asset id when assets are defined elsewhere:

```ts
videoClip("clip", { trimStart: seconds(5) });
```

## License

MIT
