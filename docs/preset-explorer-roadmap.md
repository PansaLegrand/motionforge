# Preset Explorer Roadmap

**Status:** implementation started 2026-06-17

MotionForge now has preset compilers and visual docs. The next theme is making those presets discoverable inside the developer loop, so programmers can move from "what is the name of this look?" to working scene code without hunting through docs.

The first target is the playground because it is the open-source proof surface. The CLI Studio can adopt the same catalog later after the explorer behavior is proven.

## Product Rule

The explorer must stay data-first:

- read stable metadata exported by `@motionforge/presets`
- show names, descriptions, categories, and copyable TypeScript snippets
- keep snippets valid imports that compile into ordinary scene data
- avoid editor-only hidden state or runtime-only preset behavior

## Slice PX1 - Playground Preset Explorer ✅

**Goal:** A programmer can browse all preset families in the playground and copy the right code snippet.

Targets:

- `apps/playground`
- `packages/presets`
- `docs/progress.md`

Done:

- the playground exposes a Preset Explorer panel
- users can filter by preset family
- each preset displays key, name, category, description, and a copyable snippet
- transition overlays have exported metadata like the other preset families

## Slice PX2 - Preview And Load Preset Gallery Scenes ✅

**Goal:** The explorer can load generated gallery scenes into the playground preview.

Targets:

- reuse the preset gallery scene source behind `examples/generated/presets/*.json`
- add importable preset gallery package data

Done:

- each preset family can be previewed from the explorer
- docs gallery and playground gallery share the same generated scene source through `@motionforge/showcase`

## Slice PX3 - Insert-Or-Patch Snippets

**Goal:** The explorer becomes a practical scene-authoring helper, not only a catalog.

Targets:

- copy patch examples for selected node ids
- optional "apply example patch" action when a compatible node is selected or known

Done when:

- layout/look presets can generate `setStyle` patch examples
- text/transition presets can generate add-node examples
- failures explain why a preset cannot be applied to the current scene

## Slice PX4 - CLI Studio Adoption

**Goal:** A generated project can discover presets inside `motionforge dev`.

Targets:

- share catalog/snippet data between playground and Studio
- add a compact preset panel to the CLI Studio client

Done when:

- Studio users can copy the same snippets without leaving their project preview
- no browser-only playground assumptions leak into the CLI package

## Acceptance Criteria

- A new programmer can open the playground, discover a preset, copy a snippet, and understand where it belongs.
- The explorer is driven by exported preset metadata, not manually duplicated tables.
- The UI stays small, fast, and appropriate for a developer tool.
