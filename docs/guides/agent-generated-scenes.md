# Agent-Generated Scenes

MotionForge is designed so LLMs and coding agents can generate and edit videos without controlling a browser or guessing a hidden runtime.

## The Contract

Agents should treat the scene document as the canonical artifact:

```txt
prompt -> scene JSON -> validate -> repair -> preview/export
```

For follow-up edits:

```txt
instruction -> scene patch ops -> applyScenePatch -> validate -> preview/export
```

Read:

- [`llms.txt`](../../llms.txt) for the compact agent contract
- [Scene Format](../scene-format.md) for the full schema and style matrix
- [Preset Catalog](preset-catalog.md) for stable style names
- [RFC 0001 Scene Patch Ops](../rfcs/0001-scene-patch-ops.md) for edit operations

## CLI Loop

Agents working in a filesystem should generate a scene module and run:

```sh
motionforge validate src/video.ts
motionforge print src/video.ts
motionforge dev src/video.ts
```

Validation errors are intentionally actionable. They name the path, the issue, and usually the repair.

Example:

```txt
nodes.0.children.1.id: Duplicate node id "title". Node ids must be unique across the scene so tools can patch and diff nodes reliably.
```

## Editing Existing Scenes

Use patch ops rather than re-emitting the whole scene for follow-up edits. Patch ops are id-addressed and transactional:

```json
[
  {
    "op": "setText",
    "id": "headline",
    "text": "Launch Week"
  },
  {
    "op": "setStyle",
    "id": "headline",
    "style": { "top": 720, "fontSize": 92 }
  }
]
```

If an id is wrong, `applyScenePatch()` returns closest-id hints. That is easier for a model to repair than a visual mismatch.

## Media Instructions

For project files, use the public asset convention:

```ts
const clip = videoAsset("clip", publicAsset("assets/clip.mp4"));
```

The generated scene asset is explicit:

```json
{
  "clip": {
    "id": "clip",
    "type": "video",
    "src": "/assets/clip.mp4"
  }
}
```

Do not invent files. Only reference files the user placed in `public/assets` or URLs they supplied.

## Practical Prompting Rules

- Use `@motionforge/authoring` for new programmer-facing scene modules.
- Prefer stable preset names from the preset catalog over raw style invention.
- Prefer `seconds()` in source, but remember emitted scene JSON uses integer frames.
- Keep ids semantic and stable: `headline`, `clip-main`, `music-bed`.
- Use `publicAsset()` for local files and absolute URLs for remote files.
- Validate before claiming a scene works.
- On validation failure, repair the smallest part of the scene or patch.
