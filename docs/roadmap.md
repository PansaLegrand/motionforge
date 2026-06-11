# Roadmap

Each slice follows the working practice: code + tests + docs + a `progress.md` entry, landed as one commit. motionforge is an independent open-source engine first. Downstream products are reference consumers for requirements and validation, not owners of the roadmap.

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

## The 5-week plan (current — open-source first)

Ultimate goal: a user chats, uploads media, and gets a video — previewed and exported in the browser. motionforge is the open-source engine that makes that product *assemblable*: deterministic rendering, an agent-native scene contract, and in-browser export. Downstream products (commercial or otherwise) are consumers we learn requirements from, not work items here.

Workstreams: **A** engine, **B** player/perf, **D** agent layer, **E** launch/DX. Publishing (npm scope, GitHub push, Pages deploy) is owned by the maintainer and slots in when ready — everything else is sequenced not to block on it.

### Week 1 — measure the real gap, ship the skeleton ✅ complete

- ✅ **Slice 13 — the editor-adapter spike** (`docs/editor-adapter-spike.md`): two real templates convert 100% and render end-to-end; gap list classified engine/adapter/won't-support. Engine priorities reordered by measured frequency.
- ✅ **Spike-prioritized engine slice**: `filter` chains (13/20 production video overlays use them), `zIndex` sibling paint order, `border`, `boxShadow`. (`shape` node deliberately dropped — zero occurrences in real templates.)
- ✅ **`@motionforge/player`**: deterministic `FrameClock` + canvas render loop (play/pause/seek/loop, latest-frame-wins decode policy); playground now runs on it. Audio preview designed (package README), implementation week 2.
- ✅ **RFC 0001 — scene patch ops** (`docs/rfcs/0001-scene-patch-ops.md`): id-addressed transactional patch vocabulary + mechanical eval harness design (generate/edit/repair suites).
- ✅ **User-oriented docs**: `docs/guides/getting-started.md`.

### Week 2 — close the measured gaps, make preview real (engine side ✅)

- ✅ **A**: video nodes contribute their clip audio to exports (`volume` on video nodes; placements track head clipping; `playbackRate` retimes audio varispeed-style, RMS-verified through two AAC passes).
- ✅ **B**: player audio preview — `WebAudioPreview` plays the exact export mix (`mixSceneAudio` now public) through one cached buffer + `AudioBufferSourceNode`; audio is the master clock (frame clock re-anchors on drift); injectable `AudioPreview` keeps tests deterministic.
- ✅ **D**: `applyScenePatch`/`scenePatchSchema` implemented per RFC 0001 (ten transactional id-addressed ops, closest-id hints, full revalidation); `llms.txt` teaches patching over re-emission.
- Editor-adapter productionization: **dropped from this plan** (2026-06-11 re-scope) — integration work belongs to downstream consumers, on their schedule. The spike doc remains the reference for anyone writing such an adapter.
- ◻ **D**: eval harness runner (generate suite) — moved to week 3.
- ◻ **E**: docs site skeleton — moved to week 5; `docs/guides/getting-started.md` is the seed content.

### Week 3 — make the agent loop tangible ✅ complete

- ✅ **D**: playground **agent console** — paste a scene document or a patch op list into the playground, apply it live (`validateScene`/`applyScenePatch`), see the preview update, read the validator's errors. This is the chat loop minus the LLM: it proves the contract, demos it to strangers, and dogfoods the patch API in a UI.
- ✅ **D**: eval harness runner (`tools/agent-eval`, not shipped): generate + edit suites scored mechanically per RFC 0001; provider-agnostic (any chat endpoint via env), cases and assertions are the asset.
- ✅ **E**: robustness — exact golden fixtures now have committed baseline PNGs; hash mismatches write ignored `received` and red-highlight `diff` PNG artifacts next to the golden snapshots.

### Week 4 — capability depth

- **A**: Lottie node spike (the biggest visual-capability draw for an open-source audience; baked deterministic frame-seek, never a runtime script dependency).
- **A**: audio showcase scene in the playground (first eared end-to-end check of audio preview + export).
- **B**: 1080p real-footage benchmark; chunked audio mixing for long scenes; worker-parallel export if the benchmark demands it.
- **A**: GSAP-to-keyframes baking spike (build-time only) — stretch.

### Week 5 — harden and launch surface

- Golden coverage for everything new; Playwright E2E for the playground controls; lint rule banning wall-clock/randomness in render packages.
- Docs site (seeded from the guides), examples gallery growth, README polish.
- 0.3.0 release prep: changelog, version bumps, `npm pack` checks — maintainer publishes (npm scope, GitHub push, Pages deploy) when ready.

## Explicitly deferred (unchanged)

React/JSX authoring adapter, editor-product integrations, CanvasKit renderer, Tauri desktop, MCP server (wraps patch ops once they exist), streaming video sources, visualizer overlays, CRDT/concurrent editing.
