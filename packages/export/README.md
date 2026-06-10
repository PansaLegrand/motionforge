# @motionforge/export

Browser-native video export surface for [motionforge](https://github.com/PansaLegrand/motionforge) scenes.

> **Status:** pre-M0 placeholder. `exportVideo()` currently throws; the WebCodecs export path lands after the reference render loop is stable. Use `detectExportCapability()` to gate export UI in the meantime.

## Install

```sh
npm install @motionforge/export
```

## Usage

```ts
import { detectExportCapability } from "@motionforge/export";

const capability = detectExportCapability();
// { webCodecs: boolean, videoEncoder: boolean, offscreenCanvas: boolean }
```

## License

MIT
