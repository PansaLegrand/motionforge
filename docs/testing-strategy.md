# Testing Strategy

Testing is part of the design, not a cleanup phase. Each engine slice should land with the smallest useful test that proves the behavior and makes future renderer work safer.

## Current Test Layers

- `pnpm typecheck`: strict TypeScript across every workspace package.
- `pnpm test`: Vitest unit tests for schema, core, renderer, and export capability helpers.
- `pnpm build`: package builds plus the playground production build.
- `pnpm golden:test`: Playwright-pinned Chromium renders fixture scenes and checks golden-frame hashes/probes.
- Browser smoke test: open the playground, verify the canvas renders, start playback, and check console errors.

## M0 Rules

- Schema changes need valid and invalid examples.
- Layout changes need at least one geometric assertion.
- Animation changes need deterministic numeric assertions.
- Renderer changes need either a unit-level contract test or a playground/browser smoke note.
- Export changes need capability and failure-path tests before a happy-path encode test.

## Near-Term Gaps

- Pixel diff artifacts for golden-frame failures.
- Broader golden fixture coverage for transforms, rounded clipping, gradients, and text layout.
- Playwright test for the playground scrubber/play button.
- Lint rule banning wall-clock time and unseeded randomness in render packages.
- WebCodecs export integration tests once `exportVideo()` exists.

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
