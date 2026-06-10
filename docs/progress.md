# Progress

This is the living project log. Every meaningful implementation slice should record what changed, how it was tested, and what remains uncertain.

## 2026-06-11 (export slice — M0 sequence complete)

### Changed

- `@motionforge/export`: implemented `exportVideo()` — renders the scene through the shared Canvas2D renderer via `renderFrameSequence()` and encodes to MP4 in the browser with WebCodecs, using mediabunny for encoding orchestration and muxing. Returns `{ blob, codec, totalFrames }`.
- Codec negotiation via `getFirstEncodableVideoCodec()` over all MP4-compatible codecs, so Chromium-only builds without H.264 encode fall back to VP9/AV1. Options: `startFrame`/`endFrame` sub-range export, `signal` (cancels the muxer cleanly), `bitrate` (bits/s or Quality preset), `codecs` override.
- Renders into an `OffscreenCanvas` when available, falling back to a DOM canvas. Awaits `CanvasSource.add()` per frame to respect encoder backpressure.
- Playground: added an "Export MP4" button with frame-by-frame progress, capability gating, and automatic download.
- Golden harness: added an export smoke test that encodes the `opacity-keyframe` scene in the harness browser and asserts a non-empty MP4 (`ftyp` box present, expected frame count). Runs as part of `pnpm golden:test`.
- Marked all eight M0 sequence items complete in the roadmap; updated README status, export README, and `llms.txt`.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (27 unit tests; new test covers the actionable no-WebCodecs error in Node)
- `pnpm golden:test` (7 fixtures + export smoke: 6697 bytes, avc, 31 frames, video/mp4)
- Playwright-driven playground check: clicking "Export MP4" downloaded `motionforge.mp4` (406 KiB, avc, 120 frames).

### Notes

- mediabunny (MIT) is the first runtime dependency outside zod — chosen deliberately over hand-rolling MP4 muxing; it also gives us WebM and streaming targets when we want them.
- Headless Chromium encodes AVC, so golden export smoke results are stable in CI; the codec fallback path (VP9/AV1) is untested in CI until we add a fixture that excludes AVC.
- Export duration scales with scene length (sequential frame loop). Worker-based parallel rendering is a post-M0 optimization.

## 2026-06-11 (text rendering slice)

### Changed

- `@motionforge/renderer-canvas2d`: text nodes now render multi-line. Explicit `\n` always breaks; words wrap to the box width using `measureText` with the resolved font; the line block is centered vertically, matching previous single-line placement exactly (existing exact-hash goldens unchanged).
- Implemented `fontStyle` (italic), `lineHeight` (unitless multiplier or `px`/`%`, default 1.25), and `letterSpacing` (number/`px`, via the Canvas2D `letterSpacing` API) — three of the validated-but-ignored properties from the support matrix.
- Exported `wrapTextLines(text, maxWidth, measure)` as a pure, unit-testable helper.
- `@motionforge/core`: intrinsic text estimates for flex layout now account for explicit newlines and `lineHeight`.
- Golden harness: probes can scan a row segment (`toX`) and pass if any pixel matches, making text-presence assertions robust without exact glyph hashing. Verified the probe fails on a background-only row before trusting it.
- New golden fixtures: `multiline-explicit-newline` (newlines, lineHeight pitch, italic, letterSpacing) and `multiline-word-wrap` (measured wrapping).
- Updated the style support matrix, text-behavior docs, and `llms.txt`.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (7 new `wrapTextLines` unit tests; 26 total)
- `pnpm golden:test` (7 fixtures, all passing; pre-existing exact hashes unchanged)

### Notes

- Wrapping happens at render time with real font metrics; flex intrinsic sizing still uses the character-count heuristic. Real text measurement in layout needs a metrics provider abstraction — candidate for the font-loading slice.
- `letterSpacing` relies on the Canvas2D `letterSpacing` API (Chromium-class browsers); other engines silently render without spacing until a fallback lands.

## 2026-06-11 (documentation slice)

### Changed

- Rewrote `docs/scene-format.md` into the canonical contract: full type shapes, timing model, length values, animation semantics, validation invariants, a complete example scene, and a property-by-property style support matrix (validated / layout / render, with partial-support notes).
- Added `sceneJsonSchema()` to `@motionforge/schema` (via `zod-to-json-schema`) and a committed `scene.schema.json` artifact regenerated on every build, so agents and editors can validate scenes without executing code.
- Rewrote `llms.txt` as a working agent contract: mental model, hard rules, a complete valid scene in JSON, the implemented-today style list, example validation errors, and API index.
- Rewrote the README: CI/license/status badges, playground hero screenshot, Mermaid render-pipeline and architecture diagrams, package status table, "Why not Remotion?" positioning, agent documentation section, and a builder code example.
- Added `tools/golden/src/screenshot.ts` (`pnpm --filter @motionforge/golden run screenshot`) to regenerate the README hero image deterministically from the playground at frame 40.

### Tested

- `pnpm build` (regenerates `scene.schema.json`)
- `pnpm typecheck`
- `pnpm test` (new unit test for the JSON Schema export)
- `pnpm golden:test`

### Notes

- The support matrix documents which validated properties are not yet implemented (`margin`, min/max sizes, `transformOrigin`, `fontStyle`, `lineHeight`, `letterSpacing`, `objectFit`, `objectPosition`, `justifyContent: space-between`, `alignItems: stretch`). Implementing the text-related ones is the next engine slice.
- The JSON Schema covers structure only; cross-field invariants stay in `parseScene`/`validateScene` and are documented as such.

## 2026-06-11

### Changed

- Added the browser-based golden-frame harness in `tools/golden`.
- Added initial golden fixtures for gradients, absolute insets, opacity keyframes, flex centering, and text-shadow presence.
- Made builder-generated node ids deterministic per scene serialization.
- Added duplicate node id validation so agent patches have stable node handles.
- Prepared package metadata for future public npm publishing.
- Cleaned up test command semantics so `pnpm test` is unit tests only and `pnpm golden:test` is the explicit browser pixel test.
- Added `renderFrameSequence()` in `@motionforge/export` as the deterministic bridge from still rendering to video export.
- Added export-relative and scene-relative timestamp conversion, progress callbacks, range validation, and abort handling for the export frame loop.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test`
- `pnpm golden:test`
- `pnpm --filter @motionforge/export typecheck`
- `pnpm --filter @motionforge/export test`

### Notes

- Golden tests currently store exact hashes for geometry/paint fixtures and probe-based assertions for text, because text pixels remain font/platform-sensitive until embedded fonts land.
- The next engineering slice should adapt `renderFrameSequence()` to create `VideoFrame` objects and probe `VideoEncoder` support before muxing.

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
