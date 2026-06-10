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

### JSON Schema

For tools and agents that want to validate scenes without running code, the package exports a JSON Schema (draft-07) and ships it as `scene.schema.json`:

```ts
import { sceneJsonSchema } from "@motionforge/schema";

const jsonSchema = sceneJsonSchema();
```

The JSON Schema covers structure; cross-field invariants (unique node ids, asset key = asset id, per-node-type requirements) are enforced by `parseScene` / `validateScene`.

See the [scene format docs](https://github.com/PansaLegrand/motionforge/blob/main/docs/scene-format.md) for the full document shape and the style support matrix.

## License

MIT
