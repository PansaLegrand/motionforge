# Export benchmarks

Measured with `pnpm --filter @motionforge/golden run benchmark [width height fps seconds]` — headless pinned Chromium, Apple Silicon, AVC encode via WebCodecs, synthesized full-motion footage (animated gradient + moving box) so the encoder sees real per-frame change. Stage 1 is pure render+encode; stages 2–3 round-trip the footage through video nodes (decode + composite + encode — the real workload).

## 1920×1080 @ 30 fps (2026-06-11)

| Stage | 10 s (300 f) | 30 s (900 f) |
|---|---|---|
| render + encode, no decode | 10.0 ms/frame | 7.5 ms/frame |
| 1 video node + styled caption | 21.0 ms/frame | 16.8 ms/frame |
| 2 video nodes (full + PiP @2× rate) | 37.0 ms/frame | 29.0 ms/frame |
| JS heap after heaviest stage | 35 MiB | 46 MiB |

A 30-second 1080p export with **two simultaneous decoders finishes in 26 s — faster than realtime**. Per-frame cost *improves* with scene length (warm-up amortizes), and heap stays flat from 300 to 900 frames: no leak, no growth cliff.

## 1080×1920 (vertical) @ 30 fps, 10 s

Same profile as landscape: 7.5 / 19.2 / 33.6 ms per frame, ≤ 40 MiB heap.

## Conclusions

1. **Worker-parallel export is not needed now.** Export beats realtime at production sizes on a single thread; the roadmap item stays parked until a measured workload demands it.
2. **The memory boundary is source file size, not the pipeline.** Synthesized clips here are ~3 MB. `BlobSource` fetches whole files into memory, so a 200 MB phone clip costs ~200 MB of heap before decoding begins. That — not frame processing — is what will hurt first with real user footage; streaming sources remain the eventual fix and this is the number that will justify them.
3. **Audio is the other long-scene cost** (not measured here): the export mixes one whole-scene buffer at 48 kHz stereo ≈ 23 MiB/min plus decoded source PCM, and the player's preview caches the same again. Chunked mixing is the queued fix for minutes-long scenes.

Re-run after any renderer/export change that touches the frame loop; paste new rows above with the date.
