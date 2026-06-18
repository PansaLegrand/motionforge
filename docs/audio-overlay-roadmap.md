# Audio Overlay Roadmap

**Status:** implementation started 2026-06-19

MotionForge already has `audio` assets, `audio` nodes, source trimming with `audioStartTime`, static `volume`, browser preview through `@motionforge/player`, and AAC export mixing. The next goal is production audio overlays: music beds, voiceover, sound effects, beat accents, ambience, and notification-style cues that programmers and agents can add with stable helper names.

This stays a base-layer open-source feature. Audio overlays compile to ordinary scene assets and audio nodes. Apps may expose richer UI, but they should not need app-specific mixer semantics.

## Product Rule

Audio overlays must stay data-first:

- audio overlays are ordinary `audio` nodes, not a hidden runtime graph
- local files use explicit `scene.assets` entries and fetchable `src` strings
- timing uses frame `from` / `duration`; source trim uses `audioStartTime` in seconds
- static volume uses the existing `volume` field
- helpers expose named roles and sensible defaults, but every output is patchable scene data
- fade, loop, and ducking behavior must be represented in schema and mixer code before presets claim to support it
- generated examples must prove preview/export semantics, not just TypeScript helper shapes

## Current Baseline

Already shipped:

- schema-backed `audio` nodes with `assetId`
- `audioStartTime` and `volume`
- audio asset loading through `resolveAssets()`
- AAC export mixing through `mixSceneAudio()`
- player audio preview from the exact export mix
- authoring helper `audioTrack()`
- chat asset shelf visibility and manual insert support for audio assets

Known gaps:

- no named audio overlay helper for music beds, voiceover, sound effects, ambience, or cue sounds
- no audio overlay template catalog
- no authoring-level `audioOverlay()` convenience with role defaults
- no preset patch examples for audio insertion
- deterministic chat/local instructions still focus on visual sequencing, not sound design commands
- audio nodes reject animations, so fades and ducking do not have a truthful scene representation yet
- no audio loop primitive for long music/ambience beds
- no audio stress gallery proving trim, volume, fades, looping, ducking, and export mix behavior together

## Slice AX1 - Audio Overlay Roadmap ✅

**Goal:** make the product and engine shape explicit before code grows.

Targets:

- docs

Done:

- baseline capabilities recorded
- implementation slices scoped around current engine support first, then mixer/schema extensions
- acceptance criteria defined for programmer helpers, agents, preview, and export

## Slice AX2 - Audio Overlay Preset Helper ✅

**Goal:** programmers can create common audio roles from stable names instead of hand-writing audio node fields.

Targets:

- `@motionforge/presets`
- docs/tests

Done:

- `audioOverlay()` emits schema-valid `audio` nodes from an asset id
- templates cover `backgroundMusic`, `voiceover`, `soundEffect`, `beatAccent`, `ambientBed`, and `notificationPing`
- helper exposes id, from, duration, trimStart, volume, muted, and template-specific defaults
- tests cover schema validity, template metadata, default volumes, source trim, timing, and override behavior
- docs explain that fades/looping/ducking land in later slices because the current scene contract cannot express them yet

## Slice AX3 - Authoring Audio Overlay Helper

**Goal:** `@motionforge/authoring` makes audio roles as easy as `audioTrack()` and media overlays.

Targets:

- `packages/authoring`
- docs/guides

Done when:

- `audioOverlay(asset, options)` accepts an audio asset object or existing asset id
- passing an audio asset object auto-adds it to `scene.assets`
- helper compiles through the preset helper with seconds-first authoring time values
- role aliases such as `musicBed()` and `voiceover()` are either exported or documented as thin wrappers
- generated nodes validate through `@motionforge/schema`

## Slice AX4 - Preset Catalog And Chat/App Refresh

**Goal:** audio roles become discoverable to programmers, agents, and product UIs.

Targets:

- `@motionforge/presets`
- Playground preset catalog
- `apps/chat`
- docs/examples

Done when:

- preset catalog lists audio template keys and best-use descriptions
- patch examples can insert an audio node against an existing scene audio asset
- unavailable-state messaging is clear when no audio asset exists
- chat prompt chips include background music, voiceover, and sound-effect examples
- deterministic local chat can compile basic audio instructions such as "add @Audio 1 as quiet background music" and "put @Audio 2 at 3s as a sound effect"

## Slice AX5 - Engine Volume Automation, Fades, Looping, And Ducking

**Goal:** production audio controls have a truthful serializable scene representation.

Targets:

- `@motionforge/schema`
- `@motionforge/core`
- `@motionforge/export`
- `@motionforge/player`
- docs/tests

Done when:

- audio nodes can express volume over time without pretending style animations affect sound
- fade-in and fade-out helpers compile to mixer-visible volume automation
- long music/ambience beds can loop through a node window without duplicating nodes manually
- ducking can be compiled deterministically: music lowers under voiceover/video audio windows, then recovers
- unit tests cover envelope math, chunk boundaries, overlap mixing, loop wrap, and ducking windows
- in-browser export tests decode the resulting AAC and verify audible levels before, during, and after fades/ducking

## Slice AX6 - Audio Overlay Stress Gallery

**Goal:** audio overlay regressions become audible/measurable before they reach app users.

Targets:

- `@motionforge/showcase`
- examples
- golden harness
- docs assets

Done when:

- generated stress scene covers music bed, voiceover, sound effect, beat accent, ambience, notification cue, trim start, static volume, fades, looping, and ducking once supported
- generated JSON and poster image are committed
- golden/browser test exports the scene and verifies RMS windows for expected silence, quiet bed, voiceover duck, and cue peaks
- docs explain how to refresh/render and what to listen for

## Acceptance Criteria

- A programmer can add background music, voiceover, ambience, beat accents, notification pings, or one-shot sound effects with one helper call.
- Agents can express audio intent through stable template names and patchable scene nodes.
- Chat can say "add this as quiet background music" without inventing custom mixer logic.
- Studio and Playground expose audio presets without app-specific semantics.
- Preview and export use the same audio mix.
- Fades, looping, and ducking are implemented only when they are represented in schema and covered by automated mixer/export checks.
