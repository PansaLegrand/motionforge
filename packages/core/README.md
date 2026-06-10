# @motionforge/core

Scene builder API, keyframe animation evaluator, and layout pass for [motionforge](https://github.com/PansaLegrand/motionforge), a deterministic, browser-native video scene engine.

## Install

```sh
npm install @motionforge/core
```

## Usage

```ts
import {
  composition,
  div,
  text,
  evaluateScene,
  layoutScene,
} from "@motionforge/core";

const scene = composition({ width: 1080, height: 1920, fps: 30, duration: 120 })
  .children(
    div({
      id: "bg",
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
    }),
    text("Hello", { style: { fontSize: 76, color: "#fff" } }).animate(
      "opacity",
      [
        { frame: 0, value: 0 },
        { frame: 12, value: 1, easing: "easeOut" },
      ],
    ),
  )
  .toJSON();

// Pure evaluation: scene JSON + frame number -> resolved styles -> layout boxes.
const resolved = evaluateScene(scene, 30);
const layout = layoutScene(resolved);
```

The same builder program always emits the same scene JSON, so scenes can be diffed, patched, and snapshot-tested.

## License

MIT
