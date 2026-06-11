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

## Audio preview

Scenes with audible nodes (audio nodes, or video nodes whose clips carry a soundtrack) play sound during preview automatically:

- The scene's audio is mixed **once** with the exact pure functions the export uses (`mixSceneAudio` from `@motionforge/export`) and cached as a single `AudioBuffer`. Play and seek just restart one `AudioBufferSourceNode` at an offset — no re-mixing, no per-node Web Audio graph.
- **Audio is the master clock.** Each tick compares the frame clock against the audio position; past one frame of divergence, the frame clock re-anchors to audio. A skipped video frame is invisible; skipped audio is not.
- **Best-effort by design.** No `AudioContext` (or a custom `audio: false`) means silent preview; the `AudioContext` is created lazily inside `play()`, which is normally a user gesture, satisfying autoplay policies. The exported file remains the audio source of truth.
- Bring your own implementation via the `audio` option (`AudioPreview` interface) — that's also how the deterministic tests drive it.

Known cost: the whole-scene mix is one buffer in memory (48 kHz stereo ≈ 23 MB/min). Fine for short scenes; long scenes want chunked mixing, tracked in the testing-strategy robustness list.
