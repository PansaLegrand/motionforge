# @motionforge/renderer-canvas2d

Deterministic Canvas2D still-frame renderer for [motionforge](https://github.com/PansaLegrand/motionforge) scenes. The same renderer drives preview and export, so what you scrub is what you ship.

## Install

```sh
npm install @motionforge/renderer-canvas2d
```

## Usage

```ts
import { renderStill, resolveAssets } from "@motionforge/renderer-canvas2d";

const canvas = document.createElement("canvas");
canvas.width = scene.width;
canvas.height = scene.height;

// Asset loading is the only async phase: fetch + decode once per scene.
const assets = await resolveAssets(scene);

const context = canvas.getContext("2d");
renderStill(context, scene, /* frame */ 30, { assets });
```

Works with both `CanvasRenderingContext2D` and `OffscreenCanvasRenderingContext2D`.

Rendering is pure given `(scene, frame, assets)`: the same inputs always produce the same pixels. Scenes that draw `img` nodes throw an actionable error if assets were not resolved — a frame never renders with silently missing media. `img` nodes honor `objectFit` (`fill`, `contain`, `cover`, `none`, `scale-down`), `objectPosition`, and `borderRadius` clipping.

Font assets load through the same call and register under their asset id: declare `{ id: "Inter-Bold", type: "font", src: "..." }` and style text with `fontFamily: "Inter-Bold"`. Embed fonts whenever pixel-exact text matters; unregistered families fall back through the canvas font stack.

## License

MIT
