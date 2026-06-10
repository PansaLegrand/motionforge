# Progress

This is the living project log. Every meaningful implementation slice should record what changed, how it was tested, and what remains uncertain.

## 2026-06-11

### Changed

- Added the browser-based golden-frame harness in `tools/golden`.
- Added initial golden fixtures for gradients, absolute insets, opacity keyframes, flex centering, and text-shadow presence.
- Made builder-generated node ids deterministic per scene serialization.
- Added duplicate node id validation so agent patches have stable node handles.
- Prepared package metadata for future public npm publishing.
- Cleaned up test command semantics so `pnpm test` is unit tests only and `pnpm golden:test` is the explicit browser pixel test.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm golden:test`

### Notes

- Golden tests currently store exact hashes for geometry/paint fixtures and probe-based assertions for text, because text pixels remain font/platform-sensitive until embedded fonts land.
- The next engineering slice should start the browser export prototype from the existing deterministic still-frame renderer.

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
