# Roadmap

Each slice follows the working practice: code + tests + docs + a `progress.md` entry, landed as one commit. The two-axis objective is unchanged: (a) an open-source engine good enough that strangers adopt it, (b) the engine behind the downstream editor.

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

This is simultaneously the agent-facing animation vocabulary and the compiler that the editor's named `enter`/`exit` overlay animations will map onto.

**Done when:** the TikTok example JSON can be regenerated from ~10 lines of preset calls, and presets round-trip through `validateScene`.

### Slice 11: Publish + launch surface (1 day, needs accounts)

- Push to GitHub, green CI, reserve `@motionforge`, publish 0.2.0 (the animation slices justify the bump over the unpublished 0.1.0), tag.
- Deploy the playground to GitHub Pages and link it from the README; load the TikTok example as a second selectable scene so the demo is interactive.
- README: embed the example frames/video.

**Done when:** `npm install @motionforge/core` works from a clean machine and the README demo is clickable.

## Done — week 4 prep (caption-grade text)

Slice 12 landed: `textStroke` and text-fitted per-line backgrounds, with exact goldens; `tiktokCaptions()` emits measured background styles.

## The 5-week integration plan (current)

Ultimate goal: a user chats, uploads media, and gets a video — previewed and exported in the browser. Five workstreams: **A** engine, **B** player/perf, **C** the editor adapter, **D** agent layer, **E** launch/DX. Publishing (npm scope, GitHub push, Pages deploy) is owned by the maintainer and slots in when ready — everything else is sequenced not to block on it.

### Week 1 — measure the real gap, ship the skeleton ✅ complete

- ✅ **Slice 13 — the editor-adapter spike** (`docs/editor-adapter-spike.md`): two real templates convert 100% and render end-to-end; gap list classified engine/adapter/won't-support. Engine priorities reordered by measured frequency.
- ✅ **Spike-prioritized engine slice**: `filter` chains (13/20 production video overlays use them), `zIndex` sibling paint order, `border`, `boxShadow`. (`shape` node deliberately dropped — zero occurrences in real templates.)
- ✅ **`@motionforge/player`**: deterministic `FrameClock` + canvas render loop (play/pause/seek/loop, latest-frame-wins decode policy); playground now runs on it. Audio preview designed (package README), implementation week 2.
- ✅ **RFC 0001 — scene patch ops** (`docs/rfcs/0001-scene-patch-ops.md`): id-addressed transactional patch vocabulary + mechanical eval harness design (generate/edit/repair suites).
- ✅ **User-oriented docs**: `docs/guides/getting-started.md`.

### Week 2 — close the measured gaps, make preview real

- **A**: remaining spike engine items as templates demand them; video nodes contributing audio (`styles.volume` on clips).
- **B**: player audio preview (per the design: reuse export's pure mix, one AudioBufferSource, clock re-anchors to audio on drift); thin React wrapper for the editor.
- **C**: productionize the converter as a real adapter package (font manifest from the editor's fontsource set, full animation-name coverage, unit normalization, `translateX` → `translate` rewrites).
- **D**: implement `applyScenePatch` + `scenePatchSchema` per RFC 0001; eval harness runner with the generate suite.
- **E**: docs site skeleton; example gallery growth.

### Week 3 — integration behind a flag, chat loop v1

- **C+B**: the editor editor preview renders supported compositions through motionforge behind a feature flag, Remotion fallback otherwise; in-browser export button.
- **D**: chat loop v1 in a chat UI — message + scene → patch → validate → live preview.
- **C**: caption overlays → caption presets mapping (the 14 the editor caption templates become preset option bundles).
- **A**: Lottie node spike (also covers the editor stickers).
- **B**: worker-parallel export; 1080p real-footage benchmark.

### Week 4 — the end-to-end demo (all hands)

Target scenario in the editor: upload a video → "add TikTok-style subtitles and a title that pops in" → ASR → caption presets → live preview with audio → in-browser MP4 export. Plus: GSAP-to-keyframes baking spike (build-time only, never a runtime dependency).

### Week 5 — harden and launch

Golden coverage for all new features; bug bash on real downstream-editor projects; 0.3.0 publish (player, filter/zIndex/border/boxShadow, patch ops); the editor flag rollout to a user slice; public launch with the live playground.

## Explicitly deferred (unchanged)

React/JSX authoring adapter, CanvasKit renderer, Tauri desktop, MCP server (wraps patch ops once they exist), streaming video sources, visualizer overlays, CRDT/concurrent editing.
