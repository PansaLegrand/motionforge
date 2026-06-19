# @motionforge/cli

Command-line validation and inspection tools for MotionForge scene modules.

## Install

```sh
npm install -D @motionforge/cli
```

## Usage

```sh
motionforge validate src/video.ts
motionforge print src/video.ts
motionforge inspect src/video.ts
motionforge dev src/video.ts
```

The module may export a scene object directly, a function returning a scene, or a promise resolving to either.

```ts
import { bg, makeScene, seconds, title } from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [bg("#0f172a"), title("Hello")],
});
```

`validate` exits `0` when the scene is valid and `1` when validation fails. `print` validates first, then writes formatted scene JSON to stdout.

`inspect` validates first, then writes machine-readable scene metadata:

```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "durationFrames": 150,
  "durationSeconds": 5,
  "assets": {
    "total": 1,
    "image": 1,
    "video": 0,
    "audio": 0,
    "font": 0,
    "lottie": 0
  },
  "nodes": {
    "total": 3,
    "root": 3,
    "div": 1,
    "text": 1,
    "img": 1,
    "video": 0,
    "audio": 0,
    "lottie": 0
  },
  "capabilities": {
    "hasVisuals": true,
    "hasAudio": false,
    "requiresBrowserExport": true
  }
}
```

`dev` starts MotionForge Studio for the scene module. The studio validates the source, renders it on Canvas2D, exposes a frame scrubber and JSON inspector, and enables browser MP4 export when WebCodecs is available.

## License

MIT
