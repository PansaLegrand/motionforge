# Roadmap

Each slice follows the working practice: code + tests + docs + a `progress.md` entry, landed as one commit. The two-axis objective is unchanged: (a) an open-source engine good enough that strangers adopt it, (b) the engine behind dojo-video-web.

## Done — weeks 1–2 (static + time-based media)

All six engine slices landed: asset pipeline + image rendering, font loading with exact-hash text goldens, v0.1.0 release prep, multi-stop/angled gradients + `overflow` clipping, frame-accurate video clips (trim + playbackRate), and audio nodes mixed into the exported MP4. The engine renders all four media types in the browser; 61 unit tests, 14 golden fixtures, and 11 in-browser integration checks are green. Outstanding from this phase: the credential-gated publish (GitHub push, `@motionforge` npm scope, `pnpm publish -r`).

## Week 3 — animation maturity + public launch

The TikTok-captions example exposed the gaps that matter for editor-grade motion. This week makes animation a first-class strength, then ships.

### Slice 8: Transform interpolation (1 day)

`transform` strings currently step. Parse `translate/scale/rotate` function lists and tween numerically between keyframes with matching function sequences (mismatched lists keep stepping, documented). Removes the last ⚠️ row in the support matrix; real scale-pops and slide-ins stop needing the `fontSize`/`width` workaround.

**Done when:** a `scale(1) → scale(1.25)` keyframe pair renders as a smooth tween in an exact golden, and the matrix has no partial rows.

### Slice 9: Easing expansion (0.5–1 day)

Add `cubic-bezier(x1, y1, x2, y2)` easing strings (validated, deterministic solver) and a parameterized deterministic spring preset. Schema change is additive: `easing` widens from the four-name enum to names + bezier strings.

**Done when:** frozen numeric unit tests cover the bezier solver and spring, and a golden uses each.

### Slice 10: `@motionforge/presets` (1–2 days)

A pure helper package that compiles intent into scene data — no runtime, no rendering:

- Motion presets: `popIn`, `fadeUp`, `slideIn(direction)`, `pulse`, with duration/easing options → keyframe arrays.
- Caption generator: ASR-style word timestamps (`{ word, startMs, endMs }[]`) → timed caption nodes in two styles: one-word-at-a-time (the TikTok example, automated) and accumulating karaoke with active-word highlight.

This is simultaneously the agent-facing animation vocabulary and the compiler that dojo's named `enter`/`exit` overlay animations will map onto.

**Done when:** the TikTok example JSON can be regenerated from ~10 lines of preset calls, and presets round-trip through `validateScene`.

### Slice 11: Publish + launch surface (1 day, needs accounts)

- Push to GitHub, green CI, reserve `@motionforge`, publish 0.2.0 (the animation slices justify the bump over the unpublished 0.1.0), tag.
- Deploy the playground to GitHub Pages and link it from the README; load the TikTok example as a second selectable scene so the demo is interactive.
- README: embed the example frames/video.

**Done when:** `npm install @motionforge/core` works from a clean machine and the README demo is clickable.

## Week 4 — dojo readiness

### Slice 12: Caption-grade text (1 day)

The two text features every caption template needs: `textStroke` (outline, the classic TikTok/Shorts look) and text-fitted backgrounds (pill sized to measured text per line, not a hand-sized box). Both additive style properties.

**Done when:** an exact golden shows stroked text on a fitted pill, and the presets caption generator uses them.

### Slice 13: dojo adapter spike (1 day, in the dojo repo — task chip ready)

Convert one real `CompositionData` to a scene with throwaway code, render, diff against the Remotion output. Deliverable is a gap list classified into engine work / adapter work / won't-support.

### Slice 14: Spike follow-ups + media-audio completeness (1–2 days)

Sized by the spike's gap list, plus two known items: video nodes contributing their own audio track (today an explicit audio node is required), and best-effort audio preview in the playground (export stays the source of truth). Measure 1080p decode/export with real footage and record the baseline.

### Slice 15: Robustness fill-ins (remaining time)

From the testing strategy, in order: pixel-diff artifacts written next to golden failures, a lint rule banning wall-clock/randomness in render packages, a Playwright E2E for the playground controls, and chunked audio mixing for long scenes.

## Explicitly deferred (unchanged)

React/JSX adapter, GSAP adapter (would bake GSAP timelines into keyframes at build time — never a runtime dependency), CanvasKit renderer, Tauri desktop, MCP server, streaming video sources, worker-parallel export.
