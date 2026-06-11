# Progress

This is the living project log. Every meaningful implementation slice should record what changed, how it was tested, and what remains uncertain.

## 2026-06-11 (video clips — roadmap slice 5)

### Changed

- `@motionforge/schema`: video nodes gain `videoStartTime` (source trim, **seconds** — source footage has its own timebase, independent of scene fps) and `playbackRate` (multiplier). Both reject on non-video nodes with actionable messages.
- `@motionforge/core`: `ResolvedNode` exposes `localFrame` (frames since the node became active), the basis for video time mapping. Builder `video()` accepts the new fields.
- `@motionforge/renderer-canvas2d`: video assets open through mediabunny (`Input` + `CanvasSink`) for frame-accurate decoding — no `<video>` element seeking. The async/sync boundary is explicit: `prepareFrame(scene, frame, assets)` decodes the source frame every active video node needs (`sourceTime = videoStartTime + (localFrame / fps) * playbackRate`, clamped so scenes outlasting the clip hold the last frame) and stages it per node id; `renderStill` then draws synchronously through the shared objectFit path. Drawing an unstaged or stale-staged video node throws. `videoSourceTime()` exported pure; `disposeAssets()` releases decoders.
- `@motionforge/export`: `renderFrameSequence` awaits `prepareFrame` per frame when assets are provided, so `exportVideo` handles video scenes with no API change.
- Golden harness: end-to-end in-browser video checks — synthesize a source clip with `exportVideo` (red 1s / blue 1s), composite it through two video nodes (trim 1.5s; trim 0.5s + rate 2), verify previewed pixels at two scene frames, then export the composite and decode the file to verify exported pixels match preview. No committed binary fixtures; the engine bootstraps its own.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (57 unit tests; new: source-time mapping incl. trim/rate/clamping, localFrame through nested `from` offsets, schema accept/reject for the new fields, unstaged-video error)
- `pnpm golden:test` (14 fixtures + export smoke + 5 video checks, all passing; decoded color error ≤ 4/255 per channel from double lossy encode)

### Notes

- **Timing baseline** (320x180, headless Chromium, AVC): 60-frame source export 16 ms; 30-frame composite export with two simultaneously decoding video nodes 90 ms (~3 ms/frame). No optimization needed yet; remeasure at 1080p when real footage lands.
- Clips are fetched fully into memory (BlobSource) for deterministic access; streaming sources are future work.
- The playground stays synchronous — its sample scene has no video. When a video scene lands there, `draw()` needs an async wrapper around `prepareFrame`.
- CanvasSink is unpooled so staged canvases stay valid between prepares; revisit with a pool + copy if memory becomes an issue on long scenes.

## 2026-06-11 (v0.1.0 release prep — roadmap slice 3, credential steps pending)

### Changed

- Closed M0 in `docs/m0-roadmap.md` after re-verifying every acceptance criterion.
- Added `CHANGELOG.md` with the 0.1.0 entry covering all four packages.
- Bumped `@motionforge/schema`, `core`, `renderer-canvas2d`, and `export` to 0.1.0 (they version together).
- Verified `npm pack --dry-run` for each package: dist + README + LICENSE only (plus `scene.schema.json` for the schema package); no compiled tests, no tsbuildinfo.
- README badges: status → M0 complete, version → 0.1.0.

### Tested

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm golden:test`
- `npm pack --dry-run` × 4

### Remaining manual steps (need account credentials)

1. Create the GitHub repository and push (`git remote add origin … && git push -u origin main`); confirm CI is green and badge URLs match the repo slug.
2. Reserve the `@motionforge` npm scope (npm org).
3. `pnpm publish -r --access public` from a clean checkout, then tag `v0.1.0`.
4. Optional: deploy the playground to GitHub Pages and link it from the README.

## 2026-06-11 (renderer paint completion — roadmap slice 4)

### Changed

- `@motionforge/renderer-canvas2d`: rewrote the `linear-gradient` parser. Any number of stops; direction as `<deg>` angles (CSS gradient-line math through the box center) or `to top/right/bottom/left`; rgba colors with embedded commas (paren-aware splitting); omitted `%` positions distribute evenly between neighbors; out-of-order positions clamp non-decreasing like CSS. `parseLinearGradient()` exported as a pure helper. The pre-existing `paint-gradient` exact golden hash is unchanged — the rewrite is pixel-compatible with the old two-stop format.
- New style property `overflow: "visible" | "hidden"` (schema + renderer): `hidden` clips the node's own content and its subtree to the border box, following `borderRadius` — CSS semantics, so `borderRadius` alone correctly does not clip children.
- Support matrix: `background`, `borderRadius` move to ✅; new `overflow` row. The only remaining ⚠️ is `transform` (translate/scale/rotate subset), and the only schema-only feature is `video` node drawing.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (51 unit tests; 6 new gradient-parser tests: defaults, angles, keywords, rgba commas, even distribution, clamping)
- `pnpm golden:test` (14 fixtures + export smoke; new exact fixtures `gradient-multistop-angle` and `overflow-hidden-clip` with an unclipped sibling as the negative control; all pre-existing hashes unchanged)

### Notes

- Week 1 roadmap slices 1, 2, and 4 are done. Slice 3 (GitHub push, npm publish) needs account credentials and is the remaining week-1 item.
- Gradient color stops pass through to Canvas2D unparsed, so named colors work in gradients even though keyframe interpolation doesn't interpolate them.

## 2026-06-11 (font loading — roadmap slice 2)

### Changed

- `@motionforge/renderer-canvas2d`: `resolveAssets()` now loads `font` assets through the same pipeline as images. Each font registers with the environment's FontFaceSet (`document.fonts` in windows, `self.fonts` in workers) under its **asset id**, so styles reference it as `fontFamily: "<asset id>"`. Registration is idempotent per (id, src) pair, and `ResolvedAssets` gained a `fonts` map.
- Faces register with default descriptors: name font assets per family+weight (e.g. `Inter-Bold`) and reference them without `fontWeight` instead of relying on synthetic bolding.
- Committed `tools/golden/public/fonts/inter-700-latin.woff2` (Inter Bold latin subset, OFL 1.1, 24 KB, provenance in the fonts README) as a fixture-only font — not shipped in any package.
- New **exact-hash** golden `text-embedded-font`: the first text fixture hashed exactly rather than probed, because the embedded font removes system-font platform variance. Hash reproduces across runs.
- Docs: scene-format asset section documents the font contract and the silent-fallback caveat for unregistered families; matrix and llms.txt updated.

### Tested

- `pnpm build`, `pnpm typecheck`, `pnpm test`
- `pnpm golden:test` (12 fixtures + export smoke; `text-embedded-font` exact hash stable across update/test runs)

### Notes

- Font descriptors (weight/style ranges per asset) are a future schema extension if scenes need multiple weights of one family; the per-weight asset-id convention covers current needs.
- Existing text fixtures (wrap, shadow) intentionally stay probe-based: they test layout behavior against system fonts. New text fixtures should embed fonts and use exact hashes.

## 2026-06-11 (asset pipeline + image rendering — roadmap slice 1)

### Changed

- `@motionforge/renderer-canvas2d`: added `resolveAssets(scene)` — the engine's only async phase. Fetches and decodes every `image` asset to an `ImageBitmap`; rejects with the asset id and src on any failure. Rendering stays pure given `(scene, frame, resolvedAssets)`.
- `renderStill()` accepts `options.assets`; `img` nodes now draw with `objectFit` (`fill` default, `contain`, `cover`, `none`, `scale-down`), `objectPosition` (keywords, `%` with CSS alignment semantics, `px`), and `borderRadius` clipping. Image smoothing is set explicitly so scaled pixels are deliberate. `computeObjectFit()` is exported as a pure, unit-tested helper.
- Drawing an `img` node without resolved assets throws an actionable error naming the asset and the fix — never a silently partial frame.
- `@motionforge/schema`: widened `objectFit` to the full CSS set (`none`, `scale-down` added).
- `@motionforge/export`: `renderFrameSequence` forwards `assets` to the default renderer; `exportVideo` resolves assets internally when not given pre-resolved ones.
- Sample scene gains an inline-SVG badge image (data URL, no network dependency); playground and golden harness resolve assets before rendering.
- New exact golden `image-object-fit`: contain letterbox, cover crop with `objectPosition: left top`, and fill under a rounded clip, using a committed 16x16 quadrant PNG data URL.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (45 unit tests; 6 new: objectFit geometry for all five modes, percentage/keyword objectPosition, missing-asset error path)
- `pnpm golden:test` (11 fixtures + export smoke; all pre-existing hashes unchanged)

### Notes

- The style support matrix now has **zero** validated-but-unimplemented rows. The remaining schema-only feature is `video` node drawing (roadmap slice 5); `font`/`audio` assets validate but load in later slices through this same pipeline.
- `ResolvedAssets` is deliberately a struct of maps (`{ images }`) so fonts and video sample sinks can be added without breaking the call sites.

## 2026-06-11 (core engine hardening slice)

### Changed

- `@motionforge/schema`: `parseScene`/`validateScene` remember their results in a WeakSet, so re-parsing an already-parsed scene is an identity no-op. This removes the full Zod validation that previously ran on **every frame** of preview and export (a 120-frame export validated the scene 120 times). Parsed scenes are documented as immutable.
- `@motionforge/schema`: keyframe frames must now be strictly increasing, with an actionable validation message. This makes evaluation order a contract instead of a per-call sort.
- `@motionforge/core`: `evaluateKeyframes` no longer sorts on every call (the schema guarantees order) and now **interpolates colors**: when both keyframe values parse as `#hex`/`rgb()`/`rgba()`, the value lerps per-channel in RGBA space with easing applied; other strings still step. `parseColor` is exported.
- `@motionforge/core` layout completion — every remaining layout row in the support matrix is now implemented:
  - `margin` (single value): outer spacing that shifts the box away from its anchor edge (including right/bottom-anchored absolute boxes) and shrinks auto-sized dimensions.
  - `minWidth`/`minHeight`/`maxWidth`/`maxHeight`: clamp resolved sizes; min wins over max (CSS semantics).
  - `justifyContent: "space-between"`: distributes leftover main-axis space on top of `gap`.
  - `alignItems: "stretch"`: fills the cross axis for flex children without an explicit cross size.
- `@motionforge/renderer-canvas2d`: `transformOrigin` implemented (`left`/`center`/`right`, `top`/`center`/`bottom`, `px`, `%`; default remains center).
- Support matrix, scene-format animation docs, and `llms.txt` updated; no validated-but-ignored style properties remain except `objectFit`/`objectPosition` (blocked on asset drawing).

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (10 new unit tests: color interpolation/easing on colors, parseColor forms and rejections, margin, min/max conflict, space-between positions, stretch sizing, parse-cache identity, unsorted-keyframe rejection)
- `pnpm golden:test` — 3 new exact fixtures (color-keyframe-midpoint, flex-space-between-stretch, transform-origin-rotate); all 4 pre-existing exact hashes unchanged, proving the layout refactor is pixel-identical for existing scenes

### Notes

- Color interpolation covers hex and rgb()/rgba() only; named colors and hsl() intentionally step. Revisit if scenes need them.
- The WeakSet parse cache means a scene mutated after parsing bypasses re-validation — consistent with the documented immutability contract, but worth a lint rule eventually.
- Remaining renderer gaps (not layout): gradient parser is still two-stop vertical/horizontal, borderRadius does not clip children (would need an `overflow` property), and `objectFit`/`objectPosition` await the asset-loading slice.

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
