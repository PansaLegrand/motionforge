# Testing Strategy

Testing is part of the design, not a cleanup phase. Each engine slice should land with the smallest useful test that proves the behavior and makes future renderer work safer.

## Current Test Layers

- `pnpm typecheck`: strict TypeScript across every workspace package.
- `pnpm test`: Vitest unit tests for schema, core, renderer, presets, authoring, player, export helpers, chat, and app utilities.
- `pnpm build`: package builds plus app production builds where packages define them.
- `pnpm golden:test`: Playwright-pinned Chromium renders fixture scenes, checks golden-frame hashes/probes, runs browser MP4 export smoke, and decodes exported video/audio for media assertions.
- `pnpm e2e`: launches the real playground, verifies canvas paint, playback controls, patch validation/application, audio scene playback, Lottie playback, and console cleanliness.

## RC Golden Matrix

`pnpm golden:test` is the release-candidate browser media gate. It runs `tools/golden/src/cli.ts` against `tools/golden/src/harness.ts` and the fixtures in `tools/golden/src/fixtures.ts`.

| Area                  | Coverage                                                                                                                 | Check type                          | Command            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- | ------------------ |
| Paint/layout baseline | Gradient paint, absolute insets, flex centering, space-between/stretch, overflow clipping                                | Exact frame hash                    | `pnpm golden:test` |
| Animation baseline    | Opacity midpoint, color midpoint, transform origin, transform tween/easing                                               | Exact frame hash                    | `pnpm golden:test` |
| Text baseline         | Embedded font, stroke, fitted text background, shadow presence, explicit newlines, wrapping, auto-height                 | Exact hash or probe                 | `pnpm golden:test` |
| Image/media styling   | `objectFit`, rounded image clipping, filter, z-index, border, shadow                                                     | Exact frame hash                    | `pnpm golden:test` |
| Lottie                | Source-frame seeking and playback-rate mapping for self-contained vector JSON                                            | Exact frame hash                    | `pnpm golden:test` |
| Export smoke          | Browser `exportVideo()` creates a plausible MP4 with `ftyp`, expected frame count, and codec metadata                    | Browser encode assertion            | `pnpm golden:test` |
| Video media           | Synthetic clip trim, playbackRate, preview pixel correctness, export/decode round trip                                   | Browser encode/decode assertion     | `pnpm golden:test` |
| Audio media           | Audio node export codec, audio track presence, scene-duration coverage, silence before node start, audible static volume | Browser encode/decode RMS assertion | `pnpm golden:test` |
| Audio chunks          | 0.4s audio chunks across node-start boundaries                                                                           | Browser encode/decode RMS assertion | `pnpm golden:test` |
| Video soundtrack      | Video node's embedded audio reaches export with correct timing and volume                                                | Browser encode/decode RMS assertion | `pnpm golden:test` |
| Audio automation      | `volumeEnvelope` starts quiet and reaches full level in exported MP4                                                     | Browser encode/decode RMS assertion | `pnpm golden:test` |
| Audio looping         | `loop: true` continues a 1s WAV beyond its source end in exported MP4                                                    | Browser encode/decode RMS assertion | `pnpm golden:test` |
| Playground workflow   | Real UI paints, plays, seeks, patches, loads audio and Lottie scenes, and stays console-clean                            | Playwright UI smoke                 | `pnpm e2e`         |

## Golden Artifacts

Exact hash fixtures store both JSON snapshots and PNG baselines under `fixtures/goldens`.

- Update accepted visual changes with `pnpm golden:update`.
- Inspect any mismatch before updating; hash failures write `expected`, `received`, and `diff` PNGs under `fixtures/goldens/__diffs__`.
- Probe fixtures intentionally avoid pixel-perfect hashes when text shaping is platform-sensitive but still assert visible/absent pixels.
- Browser media checks synthesize their own video and audio assets inside the harness, so they do not need large binary fixtures.

## Slice Rules

- Schema changes need valid and invalid examples.
- Layout changes need at least one geometric assertion.
- Animation changes need deterministic numeric assertions.
- Renderer changes need either a unit-level contract test or a golden/probe fixture.
- Export changes need capability/failure-path tests plus a browser encode/decode assertion when the behavior depends on WebCodecs, media decoding, muxing, or AAC output.
- Preset and authoring helpers should test emitted scene data, then rely on golden/showcase coverage for renderer-visible behavior.
- App/editor behavior should get a focused unit test for pure planning logic and a Playwright smoke only when the browser workflow is the product contract.

## Near-Term Gaps

- Ducking is still future mixer work; when it ships, add both unit windows and browser RMS checks before marking AX5 complete.
- Long-scene resource confidence needs a repeatable benchmark gate with memory notes for audio chunks, looped beds, and many-node scenes.
- Clean-machine package verification is not yet automated outside the monorepo.
- Release-gate commands are still spread across package scripts; RC4 will consolidate fast-local and full-pre-release checks.

## Verification Template

Use this in `docs/progress.md` for each meaningful change:

```md
## YYYY-MM-DD

### Changed

- ...

### Tested

- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm golden:test`
- Browser smoke: ...

### Notes

- ...
```
