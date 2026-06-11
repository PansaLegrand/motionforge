# Changelog

All four packages (`@motionforge/schema`, `@motionforge/core`, `@motionforge/renderer-canvas2d`, `@motionforge/export`) version together.

## 0.1.0 — 2026-06-11

First release. A deterministic, browser-native video scene engine: the canonical video is a JSON scene document, and preview and export share the same Canvas2D renderer.

### @motionforge/schema

- Zod scene schema for `schemaVersion: 0`: frame-based timing, a curated CSS-like style subset, keyframe animations, and an asset map.
- `parseScene` / `validateScene` with actionable, path-qualified error messages; cross-field invariants (unique node ids, asset key = asset id, per-node-type requirements, strictly increasing keyframes).
- Parse-once semantics: re-parsing an already-parsed scene is an identity no-op, so frame loops never re-validate.
- `sceneJsonSchema()` plus a shipped `scene.schema.json` (draft-07) for validating scenes without executing code.

### @motionforge/core

- Builder API (`composition`, `div`, `text`, `img`, `video`) with deterministic auto ids, serializing to the exact scene format.
- `evaluateScene(scene, frame)`: pure keyframe evaluation — numeric interpolation with easing, color interpolation in RGBA space (`parseColor` exported), string stepping.
- `layoutScene`: absolute and flex layout implementing every validated layout property (insets, margin, min/max clamps, padding, gap, `justify-content` including `space-between`, `align-items` including `stretch`).

### @motionforge/renderer-canvas2d

- `renderStill(ctx, scene, frame, { assets })`: deterministic still-frame rendering for window and offscreen canvases.
- `resolveAssets(scene)`: the engine's only async phase — decodes image assets (SVG included) and registers font assets under their asset id. Missing media fails loudly, never silently.
- Multi-line text with measured word wrap, `lineHeight`, `letterSpacing`, `fontStyle`; images with the full `objectFit` set and `objectPosition`; `linear-gradient` with arbitrary stops and angles; `overflow: "hidden"` clipping that follows `borderRadius`; transforms with `transformOrigin`.

### @motionforge/export

- `exportVideo({ scene })`: in-browser MP4 export via WebCodecs, encoded and muxed by mediabunny, with codec negotiation (AVC → VP9/AV1 fallback), sub-range export, abort, progress, and bitrate control.
- `renderFrameSequence`: the deterministic frame loop with microsecond timestamps that `exportVideo` is built on.
- `detectExportCapability()` for gating UI.

Verified by 51 unit tests and 14 pixel-exact/probed golden fixtures plus an MP4 export smoke test, all hashed against a Playwright-pinned Chromium.
