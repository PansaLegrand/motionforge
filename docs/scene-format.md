# Scene Format

The scene document is the stable contract between humans, framework adapters, agents, renderers, and exporters. Everything else in motionforge sits above or below this format.

A machine-readable JSON Schema for this format ships with the schema package at [`packages/schema/scene.schema.json`](../packages/schema/scene.schema.json) and is exported at runtime as `sceneJsonSchema()`. The JSON Schema covers structure; the cross-field invariants listed below are enforced by `parseScene` / `validateScene`.

## Top level

```ts
type Scene = {
  schemaVersion: 0; // current format version, bumped on breaking changes
  width: number; // positive integer, pixels
  height: number; // positive integer, pixels
  fps: number; // positive integer, frames per second
  duration: number; // positive integer, total frames
  assets: Record<string, Asset>;
  nodes: SceneNode[];
};

type Asset = {
  id: string; // must equal its key in scene.assets
  type: "image" | "video" | "audio" | "font";
  src: string;
};
```

## Nodes

```ts
type SceneNode = {
  id: string; // unique across the whole scene
  type: "div" | "text" | "img" | "video" | "audio";
  text?: string; // required when type is "text"
  assetId?: string; // required when type is "img", "video", or "audio"
  videoStartTime?: number; // video nodes only: source trim offset in seconds (default 0)
  playbackRate?: number; // video nodes only: speed multiplier (default 1)
  audioStartTime?: number; // audio nodes only: source trim offset in seconds (default 0)
  volume?: number; // audio nodes only: gain 0..1 (default 1)
  from?: number; // start frame, relative to the parent (default 0)
  duration?: number; // frames the node is active (default: parent's duration)
  style?: SceneStyle; // curated CSS-like subset, see the matrix below
  animations?: SceneAnimation[];
  children?: SceneNode[];
};
```

### Video timing

A video node maps its node-local frame to a source timestamp in **seconds** (source footage has its own timebase, independent of scene fps):

```txt
sourceTime = videoStartTime + (localFrame / scene.fps) * playbackRate
```

The renderer draws the last source frame at or before that timestamp. When the scene outlasts the clip, the last frame holds. `videoStartTime` and `playbackRate` validate only on video nodes.

### Audio

Audio nodes place sound on the timeline with the same `from`/`duration` frame semantics as every other node — they are not visual, so `style`, `children`, and `animations` are rejected on them. During export, every audible node is decoded, trimmed by `audioStartTime`, scaled by `volume`, and mixed (overlaps sum, the final mix clamps) into one stereo 48 kHz track muxed into the MP4. An audio node trimmed past the end of its clip contributes silence, not an error. Video nodes do not yet contribute their own audio tracks — place an explicit audio node for that.

### Timing model

Time is measured in integer frames, never wall-clock seconds.

- A node is active for frames in `[from, from + duration)`, measured in its parent's local timeline. Outside that range the node and its entire subtree are not evaluated.
- Children run on a local clock: a child's `from` is relative to the frame its parent became active. A child with `from: 10` inside a parent with `from: 20` first appears at scene frame 30.
- `duration` defaults to the parent's duration (the scene's `duration` at the root).
- `evaluateScene(scene, frame)` clamps `frame` to `[0, scene.duration - 1]`.

### Length values

Style properties that take lengths accept:

- a number — device pixels (`64`)
- `"64px"` — same
- `"50%"` — relative to the parent dimension on that axis

## Style support matrix

Validation is intentionally stricter than implementation: a property may validate today and gain behavior in a later release without a format change. The matrix below is the source of truth for what actually happens at each stage. **Validated** means the schema accepts it; **Layout** means it affects box geometry; **Render** means it affects pixels.

| Property                                         | Validated | Layout | Render | Notes                                                                                                                             |
| ------------------------------------------------ | :-------: | :----: | :----: | --------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`                                |    ✅     |   ✅   |   —    | number, `px`, or `%`                                                                                                              |
| `position`                                       |    ✅     |   ✅   |   —    | `relative` (default) or `absolute`                                                                                                |
| `left`, `top`, `right`, `bottom`                 |    ✅     |   ✅   |   —    | `right`/`bottom` only apply with `position: absolute`                                                                             |
| `inset`                                          |    ✅     |   ✅   |   —    | fallback for `left`/`top` and implied size                                                                                        |
| `padding`                                        |    ✅     |   ✅   |   —    | single value, all sides                                                                                                           |
| `display: "flex"`                                |    ✅     |   ✅   |   —    | the only non-default display                                                                                                      |
| `flexDirection`                                  |    ✅     |   ✅   |   —    | `row` (default) or `column`                                                                                                       |
| `gap`                                            |    ✅     |   ✅   |   —    | main-axis gap between flex children                                                                                               |
| `justifyContent`                                 |    ✅     |   ✅   |   —    | `flex-start` (default), `center`, `flex-end`, `space-between` (distributes leftover space on top of `gap`)                        |
| `alignItems`                                     |    ✅     |   ✅   |   —    | `flex-start` (default), `center`, `flex-end`, `stretch` (fills the cross axis for children without an explicit size)              |
| `backgroundColor`                                |    ✅     |   —    |   ✅   | any Canvas2D fill style string                                                                                                    |
| `background`                                     |    ✅     |   —    |   ✅   | solid colors or `linear-gradient` with any stop count; direction in `deg` or `to <side>`; omitted `%` positions distribute evenly |
| `borderRadius`                                   |    ✅     |   —    |   ✅   | rounds the background fill; combine with `overflow: "hidden"` to clip children (CSS semantics)                                    |
| `overflow`                                       |    ✅     |   —    |   ✅   | `visible` (default) or `hidden` — clips the node's content and subtree to the border box, following `borderRadius`                |
| `opacity`                                        |    ✅     |   —    |   ✅   | `0`–`1`, multiplies down the subtree                                                                                              |
| `transform`                                      |    ✅     |   —    |   ✅   | `translate()`, `scale()`, `rotate()` lists; pivot via `transformOrigin`; keyframes with matching function sequences tween         |
| `fontSize`                                       |    ✅     |   ✅   |   ✅   | also drives intrinsic text size in flex layout                                                                                    |
| `fontFamily`, `fontWeight`                       |    ✅     |   —    |   ✅   | font assets register under their asset id; reference as `fontFamily: "<asset id>"`                                                |
| `color`                                          |    ✅     |   —    |   ✅   | text fill                                                                                                                         |
| `textAlign`                                      |    ✅     |   —    |   ✅   | `left` (default), `center`, `right`                                                                                               |
| `textShadow`                                     |    ✅     |   —    |   ✅   | single `x y blur color` shadow                                                                                                    |
| `fontStyle`                                      |    ✅     |   —    |   ✅   | `normal` (default) or `italic`                                                                                                    |
| `lineHeight`                                     |    ✅     |   ✅   |   ✅   | unitless number = multiplier of `fontSize` (CSS semantics); `px`/`%` lengths also accepted; default `1.25`                        |
| `letterSpacing`                                  |    ✅     |   —    |   ✅   | number or `px`; uses the Canvas2D `letterSpacing` API (Chromium-class browsers)                                                   |
| `margin`                                         |    ✅     |   ✅   |   —    | single value, all sides: outer spacing that shifts the box from its anchor edge and shrinks auto sizes                            |
| `minWidth`, `minHeight`, `maxWidth`, `maxHeight` |    ✅     |   ✅   |   —    | clamp the resolved size; `min` wins over `max` (CSS semantics)                                                                    |
| `transformOrigin`                                |    ✅     |   —    |   ✅   | `left`/`center`/`right`, `top`/`center`/`bottom`, `px`, or `%` per axis; default center                                           |
| `objectFit`                                      |    ✅     |   —    |   ✅   | `fill` (default), `contain`, `cover`, `none`, `scale-down`; applies to `img` and `video` nodes                                    |
| `objectPosition`                                 |    ✅     |   —    |   ✅   | keywords (`left`/`center`/`right`, `top`/`center`/`bottom`), `%` (CSS alignment semantics), or `px` per axis                      |

✅ implemented · ⚠️ partial (see note) · 📋 validated only, planned · — not applicable

### Text behavior

`text` nodes render multi-line:

- Explicit `\n` in `text` always starts a new line; consecutive `\n` produce empty lines.
- Words wrap when a line would exceed the node's box width, measured with the resolved font (including `letterSpacing`). Runs of whitespace collapse to single spaces, like HTML text.
- A single word wider than the box gets its own line and is horizontally condensed to fit rather than overflowing.
- Lines are spaced by `lineHeight` and the whole line block is centered vertically in the node's box. `textAlign` positions each line horizontally.
- Wrapping happens at render time using real font metrics, so flex layout's intrinsic text sizing still uses the heuristic estimate documented above; give text nodes an explicit `width`/`height` when exact geometry matters.

Anything not in this table is rejected at validation time with an actionable message. Silent visual drift is treated as a bug; if you find a property behaving differently than this table says, file an issue.

## Assets and resolution

Asset loading is the engine's only asynchronous phase, and it is explicit:

```ts
import {
  prepareFrame,
  renderStill,
  resolveAssets,
} from "@motionforge/renderer-canvas2d";

const assets = await resolveAssets(scene); // fetches + decodes scene.assets
await prepareFrame(scene, frame, assets); // stages video frames (no-op without video)
renderStill(context, scene, frame, { assets }); // pure given (scene, frame, assets)
```

- `resolveAssets(scene)` fetches and decodes every `image` asset (data URLs and remote URLs alike) and loads every `font` asset. Call it once per scene, or whenever `scene.assets` changes; `exportVideo()` calls it internally when you don't pass `assets`.
- **Font assets register under their asset id**: an asset `{ id: "Inter-Bold", type: "font", src: "..." }` is referenced from styles as `fontFamily: "Inter-Bold"`. Faces register with default descriptors, so name assets per family+weight and reference them without `fontWeight` rather than relying on synthetic bolding. If a font asset is absent or fails to load, resolution rejects; text styled with an unregistered family silently falls back to the next family in the stack (standard canvas behavior), so embed fonts whenever pixel-exact text matters.
- **Video assets** open through mediabunny for frame-accurate decoding (no `<video>` element seeking). Because decoding is asynchronous and rendering is synchronous, video frames are staged per scene frame: `await prepareFrame(scene, frame, assets)` decodes what every active video node needs, then `renderStill` draws synchronously. `renderFrameSequence`/`exportVideo` call it automatically. Rendering a video node without a staged frame — or with one staged for a different scene frame — **throws**.
- Rendering a scene that draws an `img` node without resolved assets **throws** with the asset id and the fix — a frame never renders with silently missing media.
- A failed fetch or decode rejects with the asset id and src; there is no placeholder fallback by design.
- **Audio assets** open the same way (mediabunny decode); the export mixer pulls PCM from them. Preview playback in the playground is not wired yet — the exported file is the source of truth for audio.
- Call `disposeAssets(assets)` when done with a scene to release video and audio decoder resources.

## Animations

```ts
type SceneAnimation = {
  kind: "keyframes";
  property: string; // a style property name, e.g. "opacity"
  frames: Array<{
    frame: number; // node-local frame, integer >= 0
    value: number | string;
    // "linear" | "easeIn" | "easeOut" | "easeInOut"
    // | "cubic-bezier(x1, y1, x2, y2)"  (x1, x2 in [0, 1])
    // | "spring" | "spring(bounce)"      (bounce in [0, 1); 0 = no overshoot)
    easing?: string;
  }>;
};
```

- Keyframe `frame` values are local to the node's own timeline (frame 0 = the node's `from`) and must be **strictly increasing** — validation rejects unsorted or duplicate frames.
- Numeric values interpolate; `easing` on a keyframe shapes the segment _arriving at_ that keyframe (quadratic ease curves).
- String values that both parse as colors (`#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`) interpolate per-channel in RGBA space, emitting `rgba(...)` strings. Named colors, gradients, and other strings do not interpolate.
- **Transform strings tween** when both keyframes are `translate`/`scale`/`rotate` lists with matching function sequences and matching units per slot (`scale(1) → scale(1.4)`, `translate(0px, -40px) → translate(0px, 40px)`). Mismatched sequences or unit conflicts (e.g. `px` → `%`) step instead, like CSS.
- `spring` easings may overshoot past the target value mid-tween (that is the point); the final keyframe value is always exact.
- Other string values step: the value changes exactly at the next keyframe's frame.
- Before the first keyframe the first value holds; after the last keyframe the last value holds.
- The animated value overrides the node's static `style` value for that property at that frame.

## Validation invariants

Beyond per-field types, `parseScene` / `validateScene` enforce:

- Node `id`s are unique across the entire scene tree (they are the handle for patching and diffing).
- Every key in `scene.assets` equals that asset's `id`.
- `text` nodes require a `text` string.
- `img` and `video` nodes require an `assetId` pointing at `scene.assets`.
- Unknown style properties are rejected, with a message explaining the curated-subset policy.

`parseScene(input)` throws `SceneValidationError` (with structured `issues`); `validateScene(input)` returns `{ ok: true, scene }` or `{ ok: false, errors: string[] }` with messages like:

```txt
nodes.0.children.1.id: Duplicate node id "title". Node ids must be unique across the scene so tools can patch and diff nodes reliably.
nodes.0.style: Unsupported style property. motionforge v0 supports a curated CSS-like subset; move unsupported behavior into supported transforms, layout, or custom draw nodes.
```

## Complete example

A 4-second, 30 fps vertical scene: gradient background, centered title that fades in and out.

```json
{
  "schemaVersion": 0,
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 120,
  "assets": {},
  "nodes": [
    {
      "id": "background",
      "type": "div",
      "from": 0,
      "duration": 120,
      "style": {
        "width": "100%",
        "height": "100%",
        "background": "linear-gradient(180deg, #101820 0%, #244f46 100%)"
      },
      "children": []
    },
    {
      "id": "title-wrap",
      "type": "div",
      "from": 0,
      "duration": 120,
      "style": {
        "position": "absolute",
        "left": 64,
        "right": 64,
        "bottom": 160,
        "height": 180,
        "display": "flex",
        "alignItems": "center",
        "justifyContent": "center"
      },
      "children": [
        {
          "id": "title",
          "type": "text",
          "text": "Forge motion in the browser",
          "from": 0,
          "duration": 120,
          "style": {
            "fontFamily": "Inter, system-ui, sans-serif",
            "fontSize": 76,
            "fontWeight": 800,
            "color": "#ffffff",
            "textAlign": "center"
          },
          "animations": [
            {
              "kind": "keyframes",
              "property": "opacity",
              "frames": [
                { "frame": 0, "value": 0 },
                { "frame": 12, "value": 1, "easing": "easeOut" },
                { "frame": 100, "value": 1 },
                { "frame": 119, "value": 0, "easing": "easeIn" }
              ]
            }
          ],
          "children": []
        }
      ]
    }
  ]
}
```

## Versioning

`schemaVersion` is `0` while the format is pre-M0 and may change without migration tooling. From `1` onward, breaking format changes bump the version and ship with documented migrations.
