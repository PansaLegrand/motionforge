# motionforge

`motionforge` is a deterministic, browser-native video scene engine for apps and coding agents.

The project starts from one bet: the canonical video should be a serializable scene document, and preview/export should share the same renderer. JSX, React, MCP tools, editors, and desktop apps can all sit above that data layer, but the render path stays pure:

```txt
scene JSON + frame -> resolved scene -> layout -> canvas -> video frame
```

## Current Status

This repository is pre-M0. The first slice includes:

- `@motionforge/schema`: Zod scene schema and validation helpers.
- `@motionforge/core`: builder API, animation evaluator, simple layout pass, sample scene.
- `@motionforge/renderer-canvas2d`: deterministic still renderer for browser canvas.
- `@motionforge/export`: placeholder browser export API surface.
- `apps/playground`: Vite playground that renders the sample scene.

## Goals

- CSS-feel authoring without promising full CSS compliance.
- Data-first scenes that agents can validate, patch, diff, and render.
- Browser-native preview and export, using the same engine path.
- True open-source licensing under MIT.

## Quickstart

```sh
pnpm install
pnpm test
pnpm build
pnpm dev
```

## M0 Scope

M0 is intentionally small:

- Validate and serialize a scene.
- Build a scene with TypeScript helpers.
- Evaluate keyframes by frame number.
- Render a still frame to Canvas2D.
- Stand up a browser playground.
- Add the first WebCodecs/Mediabunny export path after the render loop is stable.

See [docs/m0-roadmap.md](docs/m0-roadmap.md) for the working checklist.

## Working Practice

Every meaningful code slice should include tests or a clear note explaining the current test gap. Progress is recorded in [docs/progress.md](docs/progress.md), and the test approach lives in [docs/testing-strategy.md](docs/testing-strategy.md).
