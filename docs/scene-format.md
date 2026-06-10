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
  type: "div" | "text" | "img" | "video";
  text?: string; // required when type is "text"
  assetId?: string; // required when type is "img" or "video"
  from?: number; // start frame, relative to the parent (default 0)
  duration?: number; // frames the node is active (default: parent's duration)
  style?: SceneStyle; // curated CSS-like subset, see the matrix below
  animations?: SceneAnimation[];
  children?: SceneNode[];
};
```

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

| Property                                         | Validated | Layout | Render | Notes                                                                                                                |
| ------------------------------------------------ | :-------: | :----: | :----: | -------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`                                |    ✅     |   ✅   |   —    | number, `px`, or `%`                                                                                                 |
| `position`                                       |    ✅     |   ✅   |   —    | `relative` (default) or `absolute`                                                                                   |
| `left`, `top`, `right`, `bottom`                 |    ✅     |   ✅   |   —    | `right`/`bottom` only apply with `position: absolute`                                                                |
| `inset`                                          |    ✅     |   ✅   |   —    | fallback for `left`/`top` and implied size                                                                           |
| `padding`                                        |    ✅     |   ✅   |   —    | single value, all sides                                                                                              |
| `display: "flex"`                                |    ✅     |   ✅   |   —    | the only non-default display                                                                                         |
| `flexDirection`                                  |    ✅     |   ✅   |   —    | `row` (default) or `column`                                                                                          |
| `gap`                                            |    ✅     |   ✅   |   —    | main-axis gap between flex children                                                                                  |
| `justifyContent`                                 |    ✅     |   ✅   |   —    | `flex-start` (default), `center`, `flex-end`, `space-between` (distributes leftover space on top of `gap`)           |
| `alignItems`                                     |    ✅     |   ✅   |   —    | `flex-start` (default), `center`, `flex-end`, `stretch` (fills the cross axis for children without an explicit size) |
| `backgroundColor`                                |    ✅     |   —    |   ✅   | any Canvas2D fill style string                                                                                       |
| `background`                                     |    ✅     |   —    |   ⚠️   | solid colors; `linear-gradient` limited to exactly two stops, vertical (`180deg`/`to bottom`) or horizontal          |
| `borderRadius`                                   |    ✅     |   —    |   ⚠️   | rounds the background fill; does **not** clip children                                                               |
| `opacity`                                        |    ✅     |   —    |   ✅   | `0`–`1`, multiplies down the subtree                                                                                 |
| `transform`                                      |    ✅     |   —    |   ⚠️   | `translate()`, `scale()`, `rotate()` only; pivot set by `transformOrigin`                                            |
| `fontSize`                                       |    ✅     |   ✅   |   ✅   | also drives intrinsic text size in flex layout                                                                       |
| `fontFamily`, `fontWeight`                       |    ✅     |   —    |   ✅   |                                                                                                                      |
| `color`                                          |    ✅     |   —    |   ✅   | text fill                                                                                                            |
| `textAlign`                                      |    ✅     |   —    |   ✅   | `left` (default), `center`, `right`                                                                                  |
| `textShadow`                                     |    ✅     |   —    |   ✅   | single `x y blur color` shadow                                                                                       |
| `fontStyle`                                      |    ✅     |   —    |   ✅   | `normal` (default) or `italic`                                                                                       |
| `lineHeight`                                     |    ✅     |   ✅   |   ✅   | unitless number = multiplier of `fontSize` (CSS semantics); `px`/`%` lengths also accepted; default `1.25`           |
| `letterSpacing`                                  |    ✅     |   —    |   ✅   | number or `px`; uses the Canvas2D `letterSpacing` API (Chromium-class browsers)                                      |
| `margin`                                         |    ✅     |   ✅   |   —    | single value, all sides: outer spacing that shifts the box from its anchor edge and shrinks auto sizes               |
| `minWidth`, `minHeight`, `maxWidth`, `maxHeight` |    ✅     |   ✅   |   —    | clamp the resolved size; `min` wins over `max` (CSS semantics)                                                       |
| `transformOrigin`                                |    ✅     |   —    |   ✅   | `left`/`center`/`right`, `top`/`center`/`bottom`, `px`, or `%` per axis; default center                              |
| `objectFit`, `objectPosition`                    |    ✅     |   —    |   📋   | validated; `img`/`video` drawing has not landed yet                                                                  |

✅ implemented · ⚠️ partial (see note) · 📋 validated only, planned · — not applicable

### Text behavior

`text` nodes render multi-line:

- Explicit `\n` in `text` always starts a new line; consecutive `\n` produce empty lines.
- Words wrap when a line would exceed the node's box width, measured with the resolved font (including `letterSpacing`). Runs of whitespace collapse to single spaces, like HTML text.
- A single word wider than the box gets its own line and is horizontally condensed to fit rather than overflowing.
- Lines are spaced by `lineHeight` and the whole line block is centered vertically in the node's box. `textAlign` positions each line horizontally.
- Wrapping happens at render time using real font metrics, so flex layout's intrinsic text sizing still uses the heuristic estimate documented above; give text nodes an explicit `width`/`height` when exact geometry matters.

Anything not in this table is rejected at validation time with an actionable message. Silent visual drift is treated as a bug; if you find a property behaving differently than this table says, file an issue.

## Animations

```ts
type SceneAnimation = {
  kind: "keyframes";
  property: string; // a style property name, e.g. "opacity"
  frames: Array<{
    frame: number; // node-local frame, integer >= 0
    value: number | string;
    easing?: "linear" | "easeIn" | "easeOut" | "easeInOut";
  }>;
};
```

- Keyframe `frame` values are local to the node's own timeline (frame 0 = the node's `from`) and must be **strictly increasing** — validation rejects unsorted or duplicate frames.
- Numeric values interpolate; `easing` on a keyframe shapes the segment _arriving at_ that keyframe (quadratic ease curves).
- String values that both parse as colors (`#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`, `rgba()`) interpolate per-channel in RGBA space, emitting `rgba(...)` strings. Named colors, gradients, and other strings do not interpolate.
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
