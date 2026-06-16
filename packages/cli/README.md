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

## License

MIT
