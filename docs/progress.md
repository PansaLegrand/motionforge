# Progress

This is the living project log. Every meaningful implementation slice should record what changed, how it was tested, and what remains uncertain.

## 2026-06-11 (open-source re-scope + playground agent console — week-3 slice 1)

### Changed

- **Plan re-scope:** downstream-editor integration dropped from the roadmap (the maintainer's products consume motionforge on their own schedule); weeks 3–5 now target the open-source project itself — agent loop tangibility, capabilities, robustness, launch surface.
- Playground gains an **agent console**: paste a scene document or a patch op list, apply it through the exact public APIs an agent uses (`validateScene` / `applyScenePatch`), watch the preview update, read the same errors an agent reads. Plus one-click "Copy scene JSON" for the copy → prompt → paste loop. This is the chat loop minus the LLM.
- Playground refactor: scene loading split into `loadScene(showcaseEntry)` and `loadSceneDoc(anySceneDoc)`, so patched/custom documents share the full asset/player/export lifecycle. Export now exports the *current* (possibly patched) document.
- Patch error display no longer double-prefixes op indexes (messages already carry them).
- README hero regenerated; it now shows the console.

### Tested

- Playwright drive of the real console: misspelled id surfaces the closest-id suggestion; a two-op patch (`setText` + `setStyle` with a null-delete) applies and the canvas pixel-verifies the new background; malformed JSON reports cleanly; a pasted custom scene loads (canvas resizes, pixel-verified). No console errors.
- `pnpm build`, `pnpm typecheck` green.

### Notes

- The test run itself caught a real UX subtlety: patching `backgroundColor` under an existing `background` gradient is silently shadowed (CSS-correct, but surprising). Worth a future validator hint when both are set.
- Next agent-layer step: the eval harness runner (`tools/agent-eval`), which scores generate/edit suites against these same APIs.

## 2026-06-11 (player audio preview — week-2 slice 3)

### Changed

- `@motionforge/export`: the internal mixed-track builder is now public as `mixSceneAudio(scene, assets, startFrame, endFrame)` so preview plays the exact mix the export muxes.
- `@motionforge/player`: scenes with audible nodes get sound during preview.
  - `AudioPreview` interface + `WebAudioPreview` implementation: the scene mixes once into a cached `AudioBuffer`; play/seek restart one `AudioBufferSourceNode` at an offset (no re-mixing). `AudioContext` is created lazily inside `play()` (user gesture → autoplay-safe); capability-gated, silent fallback.
  - Audio is the master clock: ticks re-anchor the frame clock to the audio position past one frame of drift. Loop wraps restart the source; `ended` stops it; `dispose()` closes the context.
  - `audio` option: omit for the default, pass an `AudioPreview` to substitute (how tests drive it), or `false` to disable.

### Tested

- `pnpm --filter @motionforge/player test` (15 tests; 4 new with a recording fake: start-at-scene-time/stop-on-pause/no-start-while-paused-seek, mid-playback seek restarts at the new offset, drift re-anchor snaps the frame clock to the audio frame, inaudible scenes never attach audio)
- Playwright playground smoke re-run green (silent scenes unaffected).
- `pnpm build`, `pnpm typecheck`, full `pnpm test` (126 unit tests).

### Notes

- Audible playback was verified structurally (fake clock) and the mix math is already RMS-verified in the golden harness; an eared end-to-end check in a real browser tab is worth doing when the playground gains an audio showcase scene.
- Whole-scene mix buffer ≈ 23 MB/min at 48 kHz stereo; chunked mixing remains on the robustness list.

## 2026-06-11 (video nodes contribute audio — week-2 slice 2)

### Changed

- `@motionforge/schema`: `volume` now validates on video nodes too (still rejected elsewhere); `audioStartTime` stays audio-only — video trims picture and sound together via `videoStartTime`, and the rejection message says so.
- `@motionforge/renderer-canvas2d`: `openVideoClip()` probes the clip's audio track on the same input and exposes it as `VideoClip.audio` (`duration`/`sampleRate`/`numberOfChannels`/`AudioBufferSink`). Silent clips simply have no `audio`; `disposeAssets()` is unchanged because the sink shares the clip's input.
- `@motionforge/export`: `collectAudioPlacements()` now returns video nodes as well, plus a new `framesIntoNode` field (head clipping by ancestor windows). The mix maps a video window to source time exactly like the renderer's `videoSourceTime` (`videoStartTime + (localFrame / fps) × playbackRate`), so exported sound stays aligned with previewed picture; `playbackRate` retimes audio by declaring the segment at rate × native sample rate — varispeed semantics (pitch shifts; no time-stretch), documented.
- Alignment fix that fell out of `framesIntoNode`: audio nodes whose *head* is clipped by an ancestor window now start that many frames into their source instead of restarting from 0 — matching the evaluator's `localFrame = absoluteFrame − from` everywhere.

### Tested

- `pnpm test` (122 unit tests; new: volume accept/reject matrix per node type, video placements with `framesIntoNode` under clipped ancestors, varispeed mixer math via a rate-scaled segment)
- `pnpm golden:test` — new in-browser round trip: a 1 s MP4 with an AAC tone soundtrack is synthesized via `exportVideo`, placed as a **video node** (frame 15, volume 0.8) in a composite, exported, and decoded back: silence before 0.5 s (rms 0.0000), tone window rms 0.2815 vs ≈0.283 theoretical through **two** AAC encode passes.
- `pnpm build`, `pnpm typecheck`

### Notes

- Pitch-preserving time-stretch for rate ≠ 1 audio is explicitly out of scope (varispeed is the documented contract); revisit only if a real consumer needs broadcast-style retiming.
- The player's audio preview (next slice) reuses these exact placements/mix functions, so video-node audio will be audible in preview with no extra engine work.

## 2026-06-11 (scene patch ops — RFC 0001 implemented; week-2 slice 1)

### Changed

- `@motionforge/schema` gains `src/patch.ts`: `applyScenePatch(scene, patch)`, `scenePatchSchema`/`sceneOpSchema` (zod), and `closestIds()`. All ten RFC ops implemented with the RFC's semantics: id-addressed, transactional (any failing op rejects the whole patch), pure/copy-on-write (input never mutated), `setStyle` merges with null-deletes, `setAnimations` replaces as a unit, `insertNode` requires caller-supplied unique ids, `removeAsset` is guarded by reference checks, `moveNode` refuses own-subtree cycles, and the final document fully revalidates so cross-field invariants hold after every patch.
- Error model per RFC: `{opIndex, message}` with path/problem/fix phrasing; missing node ids get closest-id suggestions via edit distance (`closestIds` exported for reuse by future tooling).
- `llms.txt` now tells agents to patch rather than re-emit documents, with the full op vocabulary inline. RFC 0001 status flipped to implemented.

### Tested

- `pnpm --filter @motionforge/schema test` (28 tests; 17 new: merge/null-delete, input immutability, transactionality, closest-id hints, per-op type guards, style/keyframe validation through patches, insert positioning, duplicate-id rejection, subtree removal, move-into-own-subtree rejection, guarded asset removal, meta updates, malformed-patch op indexes, cross-field revalidation, edit-distance ranking)
- `pnpm build`, `pnpm typecheck`

### Notes

- Patch ops intentionally have no JSON-Pointer escape hatch; the closed vocabulary is the contract. If a real consumer needs an op we don't have, add an op, not a pointer.
- The eval harness (RFC's generate/edit/repair suites) remains the next agent-layer step; `applyScenePatch` is its scoring function for the edit suite.

## 2026-06-11 (patch-ops RFC, getting-started guide, 5-week roadmap)

### Changed

- `docs/rfcs/0001-scene-patch-ops.md`: the agent edit vocabulary — id-addressed, transactional `ScenePatch` ops (`setStyle` merge / `setAnimations` replace semantics, guarded asset removal, no JSON-Pointer paths, pure application), error model with closest-id hints, and the mechanical eval harness design (generate/edit/repair suites scored by validator + structural assertions, no LLM judging). Implementation scheduled week 2.
- `docs/guides/getting-started.md`: first user-oriented guide — scene JSON in five minutes, player preview, MP4 export, presets, assets, and the LLM entry point.
- `docs/roadmap.md`: rewritten around the 5-week integration plan (5 workstreams, week 1 marked complete with evidence links). Publishing steps are maintainer-owned and non-blocking.

### Tested

- Docs-only slice; `pnpm test` and `pnpm golden:test` re-run green before commit (108 unit tests, 31 golden checks).

### Notes

- Week-1 scope intentionally shipped without npm/GitHub publishing (maintainer will publish when ready); nothing downstream blocks on it.

## 2026-06-11 (@motionforge/player — playback skeleton)

### Changed

- New publishable package `@motionforge/player`:
  - `FrameClock` — the only place wall-clock time exists in the playback path. Maps injected timestamps to integer frames (anchored at play/seek), pauses by re-anchoring, loops by modulo, clamps + reports `ended` otherwise. Pure given timestamps; replaying from the final frame restarts at 0.
  - `Player`/`createPlayer()` — canvas render loop on top of the clock: `play`/`pause`/`seek`/`dispose`, `loop`, `currentFrame`, events (`frame`/`play`/`pause`/`ended`). Awaits `prepareFrame()` per displayed frame with a latest-frame-wins policy (slow video decode skips ahead, never queues stale frames). Asset ownership explicit: pass `assets` and the caller owns them; omit and the player resolves/disposes.
  - `now`/`requestFrame`/`cancelFrame` injectable, so playback behavior is fully unit-tested in Node with a fake driver.
- Playground now runs on the player (replacing its hand-rolled frame-per-rAF loop, which drifted at low rAF rates); it shares one asset resolution between preview and export.
- README/llms.txt package listings updated; audio-preview design recorded in the package README (reuses export's pure mix functions, one AudioBufferSource, clock re-anchors to audio on drift).

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm --filter @motionforge/player test` (11 tests: clock time→frame mapping incl. frame-boundary rounding, pause/anchor, end clamp + ended flag, loop wrap, seek clamping with play-state preservation, replay-from-end; player frame advancement, latest-frame-wins skip, pause freeze + no leaked rAF, seek, ended event, loop, dispose inertness)
- Playwright smoke against the real playground: poster frame renders, play advances ~22 frames in 700 ms (wall-clock 30 fps), pause freezes, slider seeks, scene switching works, no console errors.

### Notes

- Audio preview is design-only this slice (see package README); export remains the audio source of truth.
- The React wrapper stays deferred until the editor integration needs it — the core is framework-free by design.

## 2026-06-11 (filter, zIndex, border, boxShadow — spike-prioritized engine slice)

### Changed

- `@motionforge/schema`: four new style properties, prioritized by measured frequency in real editor templates (see `docs/editor-adapter-spike.md`):
  - `filter` — validated chain of `brightness`/`contrast`/`saturate`/`grayscale`/`sepia`/`invert`/`opacity` (number or `%`), `hue-rotate(<deg>)`, `blur(<px>)`, or `none`. `isFilterExpression()` exported. Used by 13/20 video overlays in production templates.
  - `zIndex` — integer; paint order only, never layout.
  - `border` — `<width> [solid] <color>` string.
  - `boxShadow` — `<x> <y> [blur] <color>` string.
- `@motionforge/renderer-canvas2d`:
  - `filter` sets `context.filter` for the node's own draws; children inherit unless they set their own (per-draw application, not subtree compositing — identical to CSS for leaf media/text nodes, the dominant case). Safari silently ignores it.
  - Siblings paint in ascending `zIndex` (stable; document order breaks ties) at every tree level. A negative `zIndex` paints behind *all* siblings, including a full-canvas background sibling — CSS sibling semantics, verified visually.
  - `border` strokes inside the border box following `borderRadius` (solid only; other line styles are loud nulls). `parseBorder()` exported.
  - `boxShadow` rides the background fill via canvas shadow state (no background → no shadow, documented); `inset`/spread unsupported and make the whole value null rather than subtly wrong. `parseBoxShadow()` exported.
- Spike correction: `%` translate already tweens and resolves against the node's own box; the editor's `translateX(-100%)` is an adapter rewrite, not engine work.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (97 unit tests; new: filter expression accept/reject incl. real production filter chains, zIndex int/fractional, parseBoxShadow forms + inset/spread rejection, parseBorder forms + non-solid rejection, sibling paint order via fillStyle capture)
- `pnpm golden:test` (18 fixtures; new exact fixture `filter-zindex-border-shadow` with an unfiltered control image; rendered frame visually verified before trusting the hash; all pre-existing hashes unchanged)

### Notes

- The `shape` node type was deliberately dropped from this slice: zero occurrences in sampled production templates. It lands with the sticker work when a real consumer exists.
- Filter compositing semantics (subtree-as-group, stacking with ancestor filters) need offscreen layer rendering; revisit if a template filters a container with overlapping children.

## 2026-06-11 (the editor-adapter spike — roadmap slice 13)

### Changed

- Ran the deferred adapter spike against two real templates from the downstream timeline editor (10 and 6 overlays: remote videos, image, texts, sound). Throwaway converter at `tools/spike-editor-adapter/convert.mjs`; findings and the classified gap list in `docs/editor-adapter-spike.md`.
- Both templates convert 100% of overlays to schema-valid scenes and render end-to-end in the harness browser (example-5: 124 frames with three remote pexels videos + mixed AAC soundtrack in ~14 s, ~3 ms/frame after fetch; example-7: 203 frames in ~1.9 s).
- Verified the editor semantics in source: `zIndex = 100 − row·10` paint order, top-level `rotation` (center origin), 15-frame named enter/exit animation ramps, rem/em/empty-string style values, @fontsource class names.

### Tested

- `validateScene()` green for both converted scenes; rendered MP4s + poster frames visually verified (letter-by-letter text reveal, padded photo frame, video color/composition).
- One converter bug found and fixed during verification: paint order was inverted (image covered all text); caught by rendering, not validation — a good argument for the planned pixel-diff artifacts.

### Notes

- Engine priorities reordered by measured frequency: CSS `filter` chains (13/20 video overlays!), `zIndex` style, percent `translate`; `textDecoration` deprioritized (present on every text overlay, always `"none"`).
- Won't-support list started: `backdropFilter`, visualizer overlays, animated React stickers, 3D `flip` — these fall back to Remotion in the editor.

## 2026-06-11 (showcase launch surface — open-source demo slice)

### Changed

- Added private workspace package `@motionforge/showcase`: three shared, schema-valid demo scenes (`intro`, `tiktok-captions`, `karaoke-captions`) used by the playground and generated examples.
- Playground now has a scene picker with per-scene descriptions/proof tags; each selected scene can be scrubbed, played, and exported to MP4.
- Added `pnpm showcase:generate`, which writes the shared showcase scenes to `examples/generated/*.json` for people who want to inspect or render raw scene documents.
- Added README showcase gallery, `docs/showcase.md`, and poster images for the three demos.
- Updated the roadmap to defer the editor integration until the open-source demo surface is stronger.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (90 unit tests)
- `pnpm golden:test`
- `pnpm showcase:generate`
- Rendered all three generated scenes through the browser harness to MP4 plus poster PNGs:
  - `intro` frame 40
  - `tiktok-captions` frame 60
  - `karaoke-captions` frame 78
- Browser smoke at `http://localhost:5173/`: the scene picker lists all three showcases, switching scenes updates the metadata/poster frame, export stays enabled, and no console errors were reported.

### Notes

- The showcase package is private by design for now. It is launch/documentation surface, not a published runtime package.
- Next follow-up after verification: deploy the playground to GitHub Pages and add a live demo link.

## 2026-06-11 (caption-grade text — roadmap slice 12)

### Changed

- `@motionforge/schema`: added the caption text style contract and regenerated `scene.schema.json`: `textStroke`, `textBackgroundColor`, `textBackgroundPadding`, `textBackgroundPaddingX`, `textBackgroundPaddingY`, and `textBackgroundRadius`.
- `@motionforge/renderer-canvas2d`: text nodes now parse `textStroke` as a compact `<width> <color>` shorthand, resolve numeric/`px`/`%` widths against `fontSize`, and paint the outline before fill.
- `@motionforge/renderer-canvas2d`: `textBackgroundColor` draws one measured, rounded background per rendered line after wrapping and before stroke/fill. Padding and radius resolve against `fontSize`; negative values clamp to zero.
- `@motionforge/presets`: caption generators now apply `textStroke` by default. `tiktokCaptions()` no longer hand-sizes highlight wrapper boxes; highlighted words carry measured background styles directly on their `text` nodes.
- Added exact embedded-font goldens: `text-stroke-embedded-font` for the outline path and `caption-fitted-text-background` for stroked text over fitted per-line pills.
- Updated the scene-format support matrix, presets docs, examples notes, and `llms.txt` so the public contract and agent-facing crib sheet match the implementation.

### Tested

- `pnpm --filter @motionforge/schema test`
- `pnpm --filter @motionforge/renderer-canvas2d test`
- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (88 unit tests)
- `pnpm golden:test` (17 golden fixtures, export smoke, video/audio integration checks)

### Notes

- Slice 12 is complete. The next planned step is the editor-adapter spike: one real `CompositionData` converted into a motionforge scene, then a classified gap list.

## 2026-06-11 (0.2.0 publish prep — roadmap slice 11, credential steps pending)

### Changed

- Added the `0.2.0` changelog entry covering animation maturity since the unpublished `0.1.0` package set.
- Bumped all publishable packages to `0.2.0`: `@motionforge/schema`, `@motionforge/core`, `@motionforge/renderer-canvas2d`, `@motionforge/export`, and `@motionforge/presets`.
- Updated the README version badge to `0.2.0`.

### Tested

- `pnpm build`
- `pnpm typecheck`
- `pnpm test` (80 unit tests)
- `pnpm golden:test` (15 golden fixtures, export smoke, video/audio integration checks)
- `npm pack --dry-run` for all five publishable packages

### Remaining manual steps (need account credentials)

1. Push to GitHub and confirm CI is green.
2. Reserve or confirm access to the `@motionforge` npm scope.
3. Publish from a clean checkout with `pnpm publish -r --access public`.
4. Tag `v0.2.0`.
5. Deploy the playground to GitHub Pages and link it from the README.

## 2026-06-11 (@motionforge/presets — roadmap slice 10)

### Changed

- New package `@motionforge/presets`: pure functions that compile animation intent into scene data (depends only on `@motionforge/schema`; no runtime, no rendering).
  - Motion presets: `popIn`, `fadeUp`, `slideIn(direction)`, `pulse` — each takes `durationInFrames`/`delay`/`easing`, returns keyframe arrays using real transform tweens (`scale(0.8) → scale(1)`) and the new spring/bezier easings. `delay` holds the start value from frame 0 so keyframes stay strictly increasing.
  - Caption generators from ASR-style word timestamps (`{ word, startMs, endMs }[]`): `tiktokCaptions` (one word at a time, pop entrance, optional highlight pills, words hold until the next starts) and `karaokeCaptions` (whole line visible, per-word color ramps to the highlight during its spoken span).
- `examples/generate-tiktok.mjs`: regenerates the TikTok example's caption track from one `tiktokCaptions()` call — the roadmap acceptance criterion ("~10 lines of preset calls") met and visually verified by rendering the generated scene.
- README package table, llms.txt (agents are pointed at presets instead of hand-writing animation JSON), and examples README updated.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (80 unit tests; presets: schema validity of every preset, delay hold semantics, transform-tween usage, ms→frame mapping, pill/highlight structure, karaoke color ramp values, line span math)
- Rendered the generated scene end-to-end: 150 frames at 1080×1920 in ~1.3 s; frame 50 visually matches the hand-written example's highlight-pill style.

### Notes

- Caption pill widths derive from character count (no text measurement in data land); good enough visually, revisit when text-fitted backgrounds land in slice 12.
- These presets are the compilation target the editor's named enter/exit overlay animations will map onto in the adapter.

## 2026-06-11 (transform interpolation + easing expansion — roadmap slices 8 & 9)

### Changed

- `@motionforge/core`: transform keyframes now **tween**. `parseTransform()` normalizes `translate`/`scale`/`rotate` lists (translate → two length args, unitless = px; scale → two unitless args, sy defaults to sx; rotate → one deg arg); when two keyframes have matching function sequences and matching units per slot, every argument interpolates and the result serializes back to a transform string the renderer already parses. Mismatched sequences or unit conflicts step, like CSS. This removes the `fontSize`-pop workaround and the last ⚠️ row in the support matrix.
- `@motionforge/schema` + `@motionforge/core`: easing widens from four names to expressions — `cubic-bezier(x1, y1, x2, y2)` (x1/x2 validated into [0, 1]; deterministic Newton + fixed-iteration bisection solver) and `spring`/`spring(bounce)` (bounce in [0, 1); 0 is critically damped with no overshoot, larger bounces overshoot and settle). `isEasingExpression()` exported from schema; `cubicBezierEasing()`/`springEasing()` exported from core.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (72 unit tests; new: transform parse/normalize/reject, tween midpoints with easing, mismatch stepping, bezier endpoints/monotonicity/linear-equivalence/symmetric midpoint, spring overshoot behavior for bounce 0 vs 0.4, schema accept/reject of easing expressions)
- `pnpm golden:test` (15 fixtures + 11 integration checks; new exact fixture `transform-tween-easings` covers a bezier-eased scale+rotate tween, a spring translate, and a mismatched list holding its start value)

### Notes

- Spring easings overshoot by design; opacity driven past 1 is effectively clamped by the canvas (out-of-range `globalAlpha` assignments are ignored). Documented in scene-format.
- The matrix has no partial rows left. Every validated property is fully implemented.

## 2026-06-11 (examples: TikTok-style captions demo)

### Changed

- Added `examples/tiktok-captions.json`: a hand-written 1080×1920 scene producing the one-word-at-a-time caption style — word-timed text nodes, `fontSize` pop with `easeOut` (the current substitute for transform scale tweens), opacity fades, highlight pills, a white→gold color keyframe, an animated progress bar, and an SVG image asset. Pure JSON, no code.
- Added `tools/golden/src/render-example.ts` (`pnpm --filter @motionforge/golden run example <scene.json> <out.mp4> [frame ...]`): renders any scene JSON to MP4 plus optional PNG frames through the harness browser. Harness gained `renderGoldenExportFile` (base64 MP4) and `renderGoldenFramePng`.
- `examples/README.md` documents the workflow with frame thumbnails; rendered MP4s are gitignored.

### Tested

- `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm golden:test` (all unchanged and green)
- Rendered the example: 150 frames at 1080×1920 exported in ~1.8 s (1.6 MiB, AVC); frames 30/60/135 visually verified.

### Notes

- Known animation gap surfaced while building this: `transform` strings step rather than interpolate, so scale pops are expressed via numeric `fontSize`/`width`/`height` keyframes. Transform interpolation is the top animation follow-up, then richer easings (cubic-bezier/spring) and an animation-presets helper that compiles names like `popIn` into keyframes.

## 2026-06-11 (audio — roadmap slice 6)

### Changed

- `@motionforge/schema`: new `audio` node type. Placement uses the standard `from`/`duration` frame semantics; fields are `audioStartTime` (source trim, seconds) and `volume` (0–1). Audio nodes are not visual, so `style`, `children`, and `animations` are rejected with actionable messages (volume keyframes can lift the animations restriction later). The audio-only fields reject on other node types.
- `@motionforge/core`: `audio()` builder.
- `@motionforge/renderer-canvas2d`: audio assets open through mediabunny (`Input` + `AudioBufferSink`) in `resolveAssets()`; `disposeAssets()` releases them.
- `@motionforge/export`: `exportVideo()` mixes every audible node into one stereo 48 kHz track and muxes it into the MP4, negotiating the audio codec per browser (AAC in Chromium). The mix is **pure and unit-tested**: `collectAudioPlacements()` mirrors the evaluator's timing semantics to compute absolute audible windows (ancestor-clipped), and `mixAudioSegments()` does linear resampling, mono fan-out, volume, overlap summing, and final clamping — chosen over OfflineAudioContext so the math is deterministic and node-testable. Trimming past the clip end yields silence, not an error. `ExportVideoResult` gains `audioCodec`.

### Tested

- `pnpm build`, `pnpm typecheck`
- `pnpm test` (61 unit tests; new: placement windows through nested/clipped parents, mixer offset+volume, resampling, overlap clamping, schema accept/reject)
- `pnpm golden:test` — new in-browser audio checks: a synthesized 440 Hz WAV placed at frame 15 of a 45-frame scene exports to MP4 with an AAC track; decoding the file back measures RMS 0.0000 before 0.5 s (alignment exact) and RMS 0.2809 in the tone window vs 0.283 theoretical for 0.5 amp × 0.8 volume (volume math survives the full encode/decode loop). 45-frame export with mixed audio: 50 ms.

### Notes

- Video nodes do not yet contribute their own audio tracks; an explicit audio node is required. Documented; candidate follow-up.
- Audio preview playback in the playground is not wired; the exported file is the audio source of truth for now.
- The mixed track is built as a single AudioBuffer (fine for short scenes); long scenes may want chunked `AudioBufferSource.add()` calls later.

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
