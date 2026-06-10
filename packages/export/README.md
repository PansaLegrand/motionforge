# @motionforge/export

Browser-native video export surface for [motionforge](https://github.com/PansaLegrand/motionforge) scenes.

> **Status:** pre-M0. `renderFrameSequence()` provides the deterministic frame loop. `exportVideo()` currently throws; WebCodecs encoding lands after this loop is wired to `VideoFrame`/`VideoEncoder`.

## Install

```sh
npm install @motionforge/export
```

## Usage

```ts
import {
  detectExportCapability,
  renderFrameSequence,
} from "@motionforge/export";

const capability = detectExportCapability();
// { webCodecs: boolean, videoEncoder: boolean, offscreenCanvas: boolean }

await renderFrameSequence({
  scene,
  context,
  startFrame: 0,
  endFrame: scene.duration - 1,
  onFrame: ({ frame, timestampUs, sceneTimestampUs }) => {
    // WebCodecs will consume timestampUs next: canvas -> VideoFrame(timestampUs).
    // sceneTimestampUs remains available for scene-time diagnostics.
  },
});
```

## License

MIT
