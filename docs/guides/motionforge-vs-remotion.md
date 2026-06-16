# MotionForge vs Remotion

Remotion is excellent when you want to author videos as React components and render them through Chromium screenshots. MotionForge is built for a different base-layer contract.

## Mental Model

Remotion:

```txt
write React components -> preview in Studio -> render with Chromium/Node
```

MotionForge:

```txt
write deterministic scene data -> preview in Studio -> export in browser
```

## Main Differences

| Topic | Remotion | MotionForge |
| --- | --- | --- |
| Authoring unit | React component program | Serializable scene JSON |
| Validation | Mostly TypeScript/runtime | Schema + cross-field validation |
| Preview | DOM/React composition | Canvas2D renderer |
| Export | Headless Chromium/server-side render path | Browser WebCodecs export path |
| Agent friendliness | Agent writes code | Agent writes or patches data |
| Styling | Web platform breadth | Curated CSS-like subset |
| Storage/diffing | Source code | Scene documents and patch ops |

## Why Choose MotionForge

Choose MotionForge when:

- videos are generated or edited by agents
- scenes should be stored as JSON documents
- you need schema validation before rendering
- preview and export should share one renderer
- your product runs client-side and wants browser-native export
- you want a constrained visual contract that tools can reason about

Choose Remotion when:

- you want the full React and browser layout model
- your team is comfortable running a Node/Chromium render service
- arbitrary CSS and DOM composition are more important than data portability
- videos are authored mainly by frontend engineers, not generated as documents

## Compatibility Strategy

MotionForge should not imitate every Remotion feature. The strongest path is:

- keep the scene document canonical
- make TypeScript authoring concise
- make Studio fast enough for iteration
- expose validation errors that humans and LLMs can fix
- add adapters only when they compile down to serializable scene data

React/JSX authoring can exist later as an adapter, but it should compile to the same scene format rather than replacing it.
