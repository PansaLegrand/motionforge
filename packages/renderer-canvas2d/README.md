# @motionforge/renderer-canvas2d

Deterministic Canvas2D still-frame renderer for [motionforge](https://github.com/PansaLegrand/motionforge) scenes. The same renderer drives preview and export, so what you scrub is what you ship.

## Install

```sh
npm install @motionforge/renderer-canvas2d
```

## Usage

```ts
import { renderStill } from "@motionforge/renderer-canvas2d";

const canvas = document.createElement("canvas");
canvas.width = scene.width;
canvas.height = scene.height;

const context = canvas.getContext("2d");
renderStill(context, scene, /* frame */ 30);
```

Works with both `CanvasRenderingContext2D` and `OffscreenCanvasRenderingContext2D`.

## License

MIT
