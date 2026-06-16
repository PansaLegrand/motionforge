# MotionForge Developer Experience Roadmap

**Status:** implementation plan started 2026-06-17

MotionForge should be an open-source base layer for programmers, not only a reference chat editor. The next milestone is to make authoring a video feel as direct as Remotion's first ten minutes while preserving MotionForge's core difference: the canonical output is validated, serializable scene data.

## Positioning

Remotion's authoring promise is clear:

```txt
write React -> preview in Studio -> render video
```

MotionForge's authoring promise should be equally clear:

```txt
write deterministic TypeScript scene data -> preview in Studio -> render video in the browser or CLI
```

The project should not imitate React composition unless we intentionally build an adapter later. The primary authoring surface should be plain TypeScript that emits a MotionForge `Scene`:

```ts
import { makeScene, bg, title, seconds, fadeUp } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#0f172a"),
    title("Hello MotionForge", {
      at: seconds(1),
      duration: seconds(3),
      enter: fadeUp(),
    }),
  ],
});
```

The generated value is still plain scene JSON. Users can validate it, diff it, patch it, store it, hand it to an agent, preview it, or export it.

## Product Rule

Developer DX must reduce boilerplate without hiding the scene contract.

Good:

- seconds-first helpers that compile to integer frames
- layout helpers that compile to supported `SceneStyle`
- asset helpers that emit `scene.assets` entries and nodes
- CLI/studio tools that validate and show the generated scene JSON

Avoid:

- runtime-only behavior that cannot be serialized
- unrestricted CSS or DOM APIs that the renderer cannot implement deterministically
- magic project state that prevents a scene from being reproduced from source

## North-Star Developer Flow

```sh
pnpm create motionforge hello-video
cd hello-video
pnpm dev
```

The generated project opens a developer studio with a preview, frame scrubber, composition picker, and JSON inspector.

The user edits `src/video.ts`:

```ts
import { makeScene, bg, title, textBlock, seconds, slideIn } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#111827"),
    title("Launch Week", {
      at: seconds(0.5),
      enter: slideIn("up"),
    }),
    textBlock("Three updates. One clean video.", {
      at: seconds(1.2),
      enter: slideIn("up", { delay: 6 }),
    }),
  ],
});
```

Then renders:

```sh
pnpm motionforge render src/video.ts out.mp4
```

## Implementation Slices

Each slice should land with focused tests, docs, and a `docs/progress.md` entry.

### Slice DX1 - Seconds-First Authoring Package ✅

**Goal:** A programmer can write a polished scene with minimal TypeScript and without hand-computing frames.

Code targets:

- new `packages/authoring`
- `tsconfig.base.json`
- root `README.md`
- `docs/progress.md`

Tasks:

- Add `@motionforge/authoring`.
- Export `seconds(value)`, `frames(value)`, `time(value, unit)`, and `toFrames(value, fps)`.
- Export `makeScene()` with `size`, `fps`, `duration`, `assets`, and `children`.
- Export simple node helpers:
  - `bg(color)`
  - `box(options)`
  - `title(text, options)`
  - `textBlock(text, options)`
  - `image(assetId, options)`
  - `videoClip(assetId, options)`
  - `audioTrack(assetId, options)`
- Accept authoring options in seconds or frames, then compile to a normal MotionForge `Scene`.
- Re-export core motion presets that are safe for authoring (`fadeUp`, `popIn`, `slideIn`, `pulse`) so examples need one import.

Done when:

- A test builds a portrait scene using seconds-based timing and validates the resulting scene.
- A test proves source trim options compile to `videoStartTime` / `audioStartTime`.
- README shows the new authoring API as the first programmer example.

### Slice DX2 - Minimal CLI ✅

**Goal:** A programmer can validate and inspect a scene module from the terminal.

Code targets:

- new `packages/cli`
- package bin `motionforge`
- root `README.md`

Commands shipped:

```sh
motionforge validate src/video.ts
motionforge print src/video.ts
```

Tasks:

- Load ESM/TypeScript scene modules in Node.
- Accept a default export that is either a `Scene` or a function returning a `Scene`.
- Validate with `@motionforge/schema`.
- Print friendly validation errors.
- Defer `still` until the Node canvas dependency story is acceptable; this slice ships `validate` and `print` first.

Done when:

- `motionforge validate` exits `0` for a valid scene and non-zero for invalid scene data.
- `motionforge print` writes formatted scene JSON.
- Docs explain browser-only export vs CLI validation clearly.

### Slice DX3 - Create MotionForge Starter

**Goal:** The first command creates a working project.

Code targets:

- new `packages/create-motionforge` or `create-motionforge`
- starter template files

Tasks:

- `pnpm create motionforge my-video`
- Generate a minimal TypeScript project with:
  - `src/video.ts`
  - `src/main.ts` preview bootstrap
  - `index.html`
  - package scripts: `dev`, `validate`, `print`
- Use `@motionforge/authoring` in the starter.
- Include one image/video asset example only if asset path handling is already clear; otherwise keep v1 text-only.

Done when:

- A generated project installs, validates its scene, and opens a preview without touching the monorepo.

### Slice DX4 - Developer Studio App

**Goal:** Programmers get a Remotion Studio-like loop without changing the data-first model.

Code targets:

- `apps/studio` or evolution of `apps/playground`

Tasks:

- Load one or more local scene modules.
- Composition/scene picker.
- Canvas preview with play/pause/seek.
- Frame/time display.
- JSON inspector.
- Validation panel.
- Export button when WebCodecs is available.

Done when:

- `motionforge dev` opens the studio for the current project.
- Editing a scene module refreshes the preview.

### Slice DX5 - Asset Path Story

**Goal:** Programmer-authored videos can use local assets without hand-writing object URLs or data URLs.

Tasks:

- Define how `asset("clip.mp4")` resolves in browser dev mode.
- Define how the same scene resolves for export.
- Keep emitted scene JSON portable: either public URLs, bundled URLs, or explicit asset manifest.
- Document large-file limits and streaming-source roadmap.

Done when:

- A starter project can use one local image and one local video in preview/export.

### Slice DX6 - Documentation Path

**Goal:** Docs teach programmers before they encounter the chat app.

Docs:

- 5-minute quickstart.
- Authoring API guide.
- Animation guide.
- Media guide.
- Preview/export guide.
- MotionForge vs Remotion.
- Agent-generated scenes.

Done when:

- A new programmer can build and render a short animated scene by following docs only.

## Acceptance Criteria For The DX Milestone

- `pnpm create motionforge my-video` produces a working project.
- The default project source is under 50 lines and reads clearly.
- `motionforge validate` catches errors with actionable messages.
- `motionforge dev` previews the scene.
- `motionforge render` or browser export produces MP4, with capability caveats documented.
- The root README leads with the authoring path before the chat/editor product.
- The chat app remains a reference consumer, not the primary OSS entry point.

## Explicitly Deferred

- React/JSX adapter.
- Cloud rendering.
- Full DOM/CSS compatibility.
- Server render farm.
- Multi-composition bundling beyond simple local modules.
- Asset streaming, unless real media testing forces it earlier.
