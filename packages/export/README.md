# @motionforge/export

Browser-native video export for [motionforge](https://github.com/PansaLegrand/motionforge) scenes: the same deterministic Canvas2D renderer that drives preview feeds WebCodecs frame by frame, and [mediabunny](https://github.com/Vanilagy/mediabunny) muxes the result to MP4 — entirely in the browser, no server.

## Install

```sh
npm install @motionforge/export
```

## Usage

```ts
import { detectExportCapability, exportVideo } from "@motionforge/export";

if (!detectExportCapability().videoEncoder) {
  // Gate export UI: this browser has no WebCodecs encoder.
}

const { blob, codec, totalFrames } = await exportVideo({
  scene,
  onProgress: ({ frameIndex, totalFrames }) => {
    console.log(`encoding ${frameIndex + 1}/${totalFrames}`);
  },
});
// blob is a video/mp4 Blob ready to download or upload.
```

Options: `startFrame`/`endFrame` export a sub-range, `signal` aborts cleanly, `bitrate` takes bits/s or a mediabunny `Quality` preset, and `codecs` restricts codec choice (by default the first MP4-compatible codec this browser can encode is used — AVC where available, falling back to VP9/AV1 in Chromium-only builds).

## Lower-level frame loop

`renderFrameSequence()` is the deterministic bridge `exportVideo()` is built on — use it to feed frames into your own encoder or pipeline:

```ts
import { renderFrameSequence } from "@motionforge/export";

await renderFrameSequence({
  scene,
  context,
  onFrame: ({ frame, timestampUs, sceneTimestampUs }) => {
    // timestampUs is export-relative; sceneTimestampUs is scene-relative.
  },
});
```

## License

MIT
