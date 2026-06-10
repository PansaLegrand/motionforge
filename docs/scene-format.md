# Scene Format

The scene format is the stable contract between humans, framework adapters, agents, renderers, and exporters.

```ts
type Scene = {
  schemaVersion: 0;
  width: number;
  height: number;
  fps: number;
  duration: number;
  assets: Record<string, Asset>;
  nodes: SceneNode[];
};
```

Nodes carry:

- `id`: stable identifier.
- `type`: `div`, `text`, `img`, or `video`.
- `from` and `duration`: frame-local timing.
- `style`: the curated CSS-like subset.
- `animations`: serializable keyframes.
- `children`: nested nodes.

Unsupported properties are rejected at validation time. Silent visual drift is treated as a bug.
