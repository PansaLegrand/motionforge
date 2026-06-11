# @motionforge/presets

Pure functions that compile animation intent into [motionforge](https://github.com/PansaLegrand/motionforge) scene data. No runtime, no rendering — every helper returns plain keyframes or nodes that pass `validateScene`.

## Install

```sh
npm install @motionforge/presets
```

## Motion presets

```ts
import { popIn, fadeUp, slideIn, pulse } from "@motionforge/presets";

const node = {
  id: "title",
  type: "text",
  text: "Hello",
  style: { fontSize: 72, color: "#fff" },
  animations: [...popIn({ durationInFrames: 8 })],
};
```

`popIn`, `fadeUp`, `slideIn(direction)`, and `pulse` accept `durationInFrames`, `delay` (held from frame 0), and an `easing` expression (`spring(bounce)` and `cubic-bezier(...)` included). They use real transform tweens — `scale(0.8) → scale(1)` interpolates.

## Caption generators

Feed ASR-style word timestamps, get a timed caption track:

```ts
import { tiktokCaptions, karaokeCaptions } from "@motionforge/presets";

const track = tiktokCaptions(
  [
    { word: "FORGE", startMs: 800, endMs: 1600 },
    { word: "MOTION", startMs: 1600, endMs: 2400 },
  ],
  { fps: 30, highlightIndices: [1] },
);

scene.nodes.push(track); // one-word-at-a-time style with pop + highlight pills
```

`tiktokCaptions` renders one word at a time (each word holds until the next starts); `karaokeCaptions` keeps the whole line visible and ramps each word's color while it is spoken.

## License

MIT
