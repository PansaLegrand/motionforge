# Post-M0 Roadmap

M0 is complete: JSON scene in, MP4 out, one deterministic engine, all in the browser. This roadmap covers the next two working weeks. Each slice follows the working practice: code + tests + docs + a `progress.md` entry, landed as one commit.

The ordering principle: finish the engine's _static media_ story and publish v0.1.0 first (week 1), then add _time-based media_ — video and audio (week 2). The dojo-video-web adapter work starts only after the engine stands on its own.

## Week 1 — static media complete, first public release

### Slice 1: Asset pipeline + image rendering (1–2 days)

The last structural piece of the core engine. Design once, reuse for fonts, video, and audio.

- `@motionforge/core` (or schema): `resolveAssets(scene) → ResolvedAssets` — the explicit async phase that loads everything the scene references. Rendering stays pure: same `(scene, frame, resolvedAssets)` → same pixels.
- `renderStill(context, scene, frame, options?)` accepts resolved assets; `img` nodes draw with `objectFit` (`contain`/`cover`/`fill`/`none`/`scale-down`) and `objectPosition`.
- Missing/unloaded assets fail loudly with actionable errors — never render a partial frame silently.
- `exportVideo()` resolves assets once before the frame loop.
- Golden fixtures use small committed fixture images (or data URLs) so hashes stay deterministic; playground sample scene gains an image layer.

**Done when:** the style support matrix has zero "validated only" rows; goldens cover contain/cover and a missing-asset error path.

### Slice 2: Font loading (1 day)

- `font` assets load through the same pipeline via `FontFace`; text renders with the loaded family.
- Commit a small OFL-licensed font for fixtures, then **upgrade the text golden probes to exact hashes** — embedded fonts remove the platform-dependence that forced probe-based assertions.
- Document the fallback chain when a font asset fails or is absent.

**Done when:** a golden renders text with a bundled font as an exact hash on CI.

### Slice 3: M0 close-out + v0.1.0 publish (1 day)

- Re-verify the M0 acceptance criteria together; flip the README badge from pre-M0 to v0.1.0.
- Push to GitHub (no remote exists yet), confirm CI is green there, fix badge/repository URLs if the repo slug differs.
- Reserve the `motionforge` npm org / `@motionforge` scope (manual step — requires the npm account).
- Add a CHANGELOG, version all four packages 0.1.0, `npm publish --access public` from a clean checkout, tag `v0.1.0`.
- Optional same day: deploy the playground to GitHub Pages and link it from the README — a live demo is the strongest top-of-README asset after the hero image.

**Done when:** `npm install @motionforge/core` works from a fresh project and the README quickstart is true for external users.

### Slice 4: Renderer paint completion (1 day)

The two remaining ⚠️ rows in the matrix:

- `background: linear-gradient(...)`: arbitrary stop counts and arbitrary angles (currently exactly two stops, vertical/horizontal only).
- `overflow: "hidden"` (new schema property, additive): clip children to the border box, respecting `borderRadius` — closes the "borderRadius does not clip children" caveat.

**Done when:** matrix has no ⚠️ rows; exact goldens cover multi-stop angled gradients and rounded clipping.

## Week 2 — time-based media

### Slice 5: Video clips (2–3 days, the hard one)

The flagship capability: video-in-video, deterministically, in the browser.

- Schema (additive): `videoStartTime` (trim offset, frames or seconds — decide and document) and `playbackRate` on `video` nodes.
- Asset pipeline: mediabunny `Input` + sample sink to decode the exact source frame for a given scene frame — deterministic timestamp mapping, no `<video>` element seeking (not frame-accurate).
- Renderer draws the decoded frame with the existing `objectFit` path (shared with `img`).
- Export: decode is sequential per frame; measure speed on a 1080p clip and record the baseline in `progress.md` before optimizing anything.
- Golden: commit a tiny generated test clip (we can synthesize one with `exportVideo()` itself — the engine bootstrapping its own fixture) and exact-hash a composited frame.

**Done when:** a scene with a trimmed, scaled video clip exports an MP4 whose pixels match preview.

### Slice 6: Audio (2 days)

- Schema (additive): audio nodes or audio properties on `video` nodes — `volume`, trim; decide whether audio is a node type (`sound`) or stays asset-level.
- Export: decode source audio with mediabunny, mix overlapping tracks, attach an audio track to the MP4 output.
- Preview: best-effort playback sync in the playground (documented as preview-only; export is the source of truth).

**Done when:** an exported MP4 contains mixed audio aligned with the frame timeline.

### Slice 7: dojo-video-web adapter spike (1 day, in the dojo repo)

Only after slices 1–6: take one real `CompositionData` document from dojo, write a throwaway `Overlay[] → Scene` converter, render it with motionforge, and diff against the Remotion output visually. The output is a gap list, not shipped code — it tells us what the engine still needs (likely: text stroke, caption backgrounds, named animation presets) before a real adapter is worth building.

## Continuous / fill-in tasks (good for partial days)

From `testing-strategy.md` near-term gaps, in priority order:

1. Pixel-diff artifacts on golden failures (write the actual/expected PNGs next to the report) — makes golden regressions debuggable.
2. Lint rule banning `Date.now`/`performance.now`/`Math.random` in render packages — turns the determinism hard rule into tooling.
3. Playwright test for the playground scrubber/play/export buttons (the export click-test already exists as a pattern in git history).
4. Color interpolation for named colors / `hsl()` — only if scenes start needing it.

## Explicitly deferred (unchanged from M0)

React/JSX adapter, GSAP adapter, CanvasKit renderer, Tauri desktop, MCP server — none of these before the engine renders all four media types and has shipped to npm.
