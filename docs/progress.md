# Progress

This is the living project log. Every meaningful implementation slice should record what changed, how it was tested, and what remains uncertain.

## 2026-06-10

### Changed

- Created the `motionforge` pnpm monorepo.
- Added `@motionforge/schema` with Zod validation for the first scene format.
- Added `@motionforge/core` with the builder API, keyframe evaluator, sample scene, and simple layout pass.
- Added `@motionforge/renderer-canvas2d` with the first still-frame renderer.
- Added `@motionforge/export` with capability detection and the planned export API surface.
- Added a Vite playground that previews the same scene through the Canvas2D renderer.
- Added README, `llms.txt`, M0 roadmap, scene-format docs, fixture scene, and CI.

### Tested

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- Browser smoke test at `http://localhost:5173/`: loaded playground, played the sample scene, verified no console errors.

### Notes

- Browser export is intentionally a placeholder until the render loop stabilizes.
- The first layout pass is deliberately small and already has a regression test for absolute left/right insets and subtitle clipping.
