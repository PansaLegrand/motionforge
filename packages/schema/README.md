# @motionforge/schema

Zod scene schema and validation helpers for [motionforge](https://github.com/PansaLegrand/motionforge), a deterministic, browser-native video scene engine.

A motionforge scene is a serializable JSON document. This package defines that document's schema and the helpers used to validate it before rendering.

## Install

```sh
npm install @motionforge/schema
```

## Usage

```ts
import { parseScene, validateScene } from "@motionforge/schema";

// Throws SceneValidationError with readable messages on invalid input.
const scene = parseScene(sceneJson);

// Or get a result object instead of an exception.
const result = validateScene(sceneJson);
if (!result.ok) {
  console.error(result.errors);
}
```

See the [scene format docs](https://github.com/PansaLegrand/motionforge/blob/main/docs/scene-format.md) for the full document shape.

## License

MIT
