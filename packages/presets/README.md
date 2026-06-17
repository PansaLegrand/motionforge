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

## Caption Generators

Feed ASR-style word timestamps, get a timed caption track:

```ts
import {
  captionTemplates,
  karaokeCaptions,
  styledCaptions,
  tiktokCaptions,
} from "@motionforge/presets";

const track = tiktokCaptions(
  [
    { word: "FORGE", startMs: 800, endMs: 1600 },
    { word: "MOTION", startMs: 1600, endMs: 2400 },
  ],
  { fps: 30, highlightIndices: [1] },
);

scene.nodes.push(track); // one-word-at-a-time style with pop + measured highlight pills
```

`tiktokCaptions` renders one word at a time (each word holds until the next starts); highlighted words use `textBackgroundColor`/padding/radius on the text node itself, so pill widths come from the renderer's font measurement instead of character-count guesses. Caption presets also apply `textStroke` by default. `karaokeCaptions` keeps the whole line visible and ramps each word's color while it is spoken.

For community-ready subtitle looks, use the native template catalog:

```ts
const captions = styledCaptions(words, {
  fps: 30,
  template: "spotlight",
  area: { top: "66%", height: "20%" },
});

scene.nodes.push(captions);
console.log(Object.keys(captionTemplates));
```

Available templates: `classic`, `minimalBar`, `handwritten`, `retro`, `cinematic`, `storyteller`, `hustle`, `spotlight`, `karaoke`, `neon`, `future`, `terminal`, and `colorShift`. They compile to plain motionforge scene nodes; there is no Remotion, DOM, or adapter dependency.

## Text overlay templates

Common non-subtitle overlays are also compiled to ordinary scene nodes:

```ts
import {
  textOverlay,
  textOverlayTemplates,
} from "@motionforge/presets";

scene.nodes.push(
  textOverlay({
    template: "lowerThird",
    id: "speaker",
    title: "Ada Lovelace",
    subtitle: "Programmer",
    kicker: "Interview",
    from: 30,
    duration: 120,
  }),
);

console.log(Object.keys(textOverlayTemplates));
```

Available templates: `titleCard`, `lowerThird`, `quoteCard`, `statCallout`, `announcementBanner`, `socialHook`, and `chapterTitle`.

All templates accept `id`, `from`, `duration`, `accentColor`, container `style`, per-slot style overrides such as `titleStyle`, and `enter` animations. Pass `enter: false` for a static overlay.

## Media look presets

Named looks return plain `SceneStyle` fragments, so they compose with image/video helpers and layout presets:

```ts
import { mediaLook, mediaLooks } from "@motionforge/presets";

videoClip(clip, {
  style: {
    width: "100%",
    height: "100%",
    ...mediaLook("cinematicWarm"),
  },
});

console.log(Object.keys(mediaLooks));
```

Available looks: `cleanProduct`, `punchySocial`, `cinematicWarm`, `coolNoir`, `retroTape`, `softPortrait`, and `blurredBackdrop`.

The styles use MotionForge's supported `filter` subset. Safari may preview filters differently or ignore them; exported support follows the browser Canvas2D implementation.

## Timeline choreography

Sequencing several nodes means deriving frame offsets from other durations — the arithmetic both humans and LLMs get wrong. `timeline()` owns it:

```ts
import { timeline, popIn, fadeUp, slideIn } from "@motionforge/presets";

const tl = timeline()
  .add("title", popIn({ durationInFrames: 12 })) // starts at 0
  .add("subtitle", fadeUp(), { after: "title", overlap: 4 }) // starts at 12 - 4 = 8
  .stagger(["card-1", "card-2", "card-3"], slideIn("left"), { every: 5 });

const animations = tl.compile(); // Record<nodeId, SceneAnimation[]>
node.animations = animations["title"];

// or emit RFC 0001 patch ops directly:
applyScenePatch(scene, tl.compileToPatch());
```

- Entries default to starting **when the previous entry ends** (the GSAP timeline default); `at` positions absolutely, `after: "<id>"` targets an earlier entry, `overlap`/`gap` nudge from there, `stagger` spaces a group `every` N frames.
- Offsets compile to a frame-0 hold of each preset's first value, so an entrance's held `opacity: 0` keeps the node invisible until its slot — no node retiming involved.
- Pure and deterministic; the output round-trips `validateScene`. Choreographed nodes are assumed to share the same `from` (keyframes run on each node's local clock).
- `tl.durationInFrames` reports where the last entry ends.

## License

MIT
