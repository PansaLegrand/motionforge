# M0 Roadmap

M0 proves the thesis with the smallest useful engine.

## Acceptance Criteria

- A scene validates through `@motionforge/schema`.
- The builder API serializes to that exact scene format.
- Animation values are resolved as pure functions of `frame`.
- The Canvas2D renderer draws the same scene used by preview.
- The playground can scrub frames.
- A basic browser export API exists behind capability checks.
- Each implementation slice updates [progress.md](progress.md) and lands with tests or a documented test gap.

## Sequence

1. Scene schema and actionable validation.
2. Builder API and round-trip tests.
3. Animation evaluator with frozen numeric tests.
4. Simple layout pass for absolute/flex-centered scenes.
5. Canvas2D reference renderer.
6. Playground still-frame preview.
7. Deterministic frame sequence loop for export.
8. WebCodecs/Mediabunny export prototype.

## Deferred

- React adapter.
- GSAP adapter.
- CanvasKit.
- Tauri desktop.
- MCP server.
- Real video decode.
- Full typography stack.
