# @motionforge/player

Real-time playback for motionforge scenes: a deterministic frame clock plus a canvas render loop with play/pause/seek/loop.

```ts
import { createPlayer } from "@motionforge/player";

const context = canvas.getContext("2d")!;
const player = await createPlayer({ context, scene, loop: true });

player.play();
player.on("frame", (frame) => slider.value = String(frame));
player.pause();
await player.seek(45);
player.dispose();
```

## Design

- **Wall-clock time exists only in the clock.** `FrameClock` maps `performance.now()` to integer frames anchored at the last play/seek; rendering stays the engine's pure `(scene, frame)` function. Playback at 30 fps shows the same pixels as export at 30 fps.
- **Latest frame wins.** The loop awaits `prepareFrame()` (video decode) per displayed frame. If a decode is slow, the next tick re-reads the clock and skips ahead — no stale-frame queue, no tearing.
- **Injectable time and scheduler.** `now`, `requestFrame`, and `cancelFrame` are constructor options, so the full play/pause/seek/ended/loop behavior is unit-tested in Node with a fake driver — no timers, no flake.
- **Asset ownership is explicit.** Pass `assets` and you own their lifetime (the playground shares one resolution between preview and export); omit them and the player resolves on create and releases on `dispose()`.

Events: `frame`, `play`, `pause`, `ended` (non-looping playback pauses on the final frame). `currentFrame` is the last rendered frame.

## Audio preview (design — lands next)

Export already mixes audio deterministically (`collectAudioPlacements()` + `mixAudioSegments()` in `@motionforge/export`). Preview reuses that math instead of duplicating timing logic:

1. On `play()`, build (or reuse) the scene's mixed stereo buffer via the same pure mix functions, sliced from the current frame: `offsetSeconds = frame / fps`.
2. Play it through one `AudioBufferSourceNode` on an `AudioContext`; `pause()`/`seek()` stop the source and re-slice. No per-node Web Audio graph — one source, one gain.
3. Drift correction: each tick compares `audioContext.currentTime − startTime` against the clock's elapsed time; if they diverge past one frame, the *clock* re-anchors to audio (audio hardware is the steadier reference; a skipped video frame is invisible, a skipped audio buffer is not).
4. The export path stays the source of truth: preview audio is best-effort and a capability check (`AudioContext` present, user-gesture unlock) gates it, mirroring how export gates on WebCodecs.

Known cost: re-mixing on every seek is O(scene audio). Fine for short scenes; long scenes want the chunked mixing already planned for export (`testing-strategy.md` robustness list).
