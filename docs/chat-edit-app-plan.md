# Chat + Edit Coexistence Plan

**Status:** product direction accepted 2026-06-15

MotionForge should ship a reference app where chat and manual editing coexist. The first draft starts in chat because natural language is the fastest way to create a video from nothing. Once the result is close, the user can hide chat and use direct editing tools for precision. The app is not a traditional NLE with chat bolted on, and it is not a chat-only toy. It is a scene-document editor with two input surfaces.

## Product Position

MotionForge is a deterministic, browser-native, agent-editable video engine with a reference AI editor.

The reference app should demonstrate:

- prompt to scene generation
- preview through the same engine used for export
- follow-up edits as scene patches
- manual editing for precision adjustments
- export from the same canonical scene document

The app should borrow product design and proven interaction ideas from the existing Dojo editor, but it should not copy the app wholesale. Dojo is a mature product prototype; MotionForge is a clean open-source engine and reference editor with a different rendering core.

## Core Rule

The canonical video is always a MotionForge `Scene`.

Every edit path must converge on the same operation model:

```txt
chat instruction -> ScenePatch -> applyScenePatch -> Scene
manual UI action -> ScenePatch -> applyScenePatch -> Scene
```

Manual tools should not own a second persistent overlay model. They may use derived view models for rendering editor controls, but those view models are projections of the scene, not a competing source of truth.

## UX Shape

The first screen is the working editor, not a landing page.

Default layout:

- left or right chat panel
- central preview canvas
- inspector/layers panel
- compact timeline below the preview

The chat panel can be collapsed. Collapsing chat should preserve conversation state, current scene, selected node, pending diagnostics, and undo history.

Chat should be selection-aware:

- no selection: edit the overall scene
- one node selected: default follow-up instructions to that node
- multiple nodes selected: default follow-up instructions to that group
- timeline range selected: default follow-up instructions to timing within that range

Examples:

```txt
select title -> "make this more premium"
select captions -> "use karaoke style"
select clip -> "crop tighter and brighten it"
select timeline range -> "make this section faster"
```

## Manual Editing Scope

Start with precision controls that solve the "almost there" problem.

### Phase A - Precision Panel

- selectable canvas nodes
- layer list
- basic inspector
- text content editing
- position and size controls
- color, opacity, font size, object fit
- from and duration controls
- undo and redo
- patch log for debugging and teaching

### Phase B - Compact Timeline

- playhead scrubber
- layer blocks by node
- drag block to retime
- resize block edges to trim duration
- split node at playhead
- reorder layers
- zoom controls
- snapping to playhead and neighboring blocks

### Phase C - Caption Editing

- caption group view
- edit words/text
- retime caption blocks
- apply caption style presets
- convert transcript or word timings into caption nodes

### Phase D - Chat/Manual Fusion

- selection-aware prompts
- visible assistant changes before apply when risk is high
- accept/revert last patch
- repair loop for invalid patches
- natural-language commands generated from manual edits for explainability

## What To Borrow From Dojo

Borrow selectively:

- timeline row behavior
- drag, resize, split, duplicate interactions
- snapping behavior
- overlay/layer list mental model
- caption editing workflows
- local media panel concepts
- style/template presets
- history and autosave patterns
- small UI affordances that already proved useful in production

Do not borrow wholesale:

- Remotion render/export path
- Pixi renderer path
- paid-product project/auth contexts
- Prisma or server-owned persistence
- full app shell and route structure
- Dojo's overlay model as the canonical document
- arbitrary React sticker/template runtime

## Scene Projection Model

Manual editor components can operate on a derived model:

```ts
type EditorLayer = {
  id: string;
  type: "text" | "image" | "video" | "audio" | "lottie" | "div";
  label: string;
  from: number;
  duration: number;
  parentId?: string;
  bounds?: { left: number; top: number; width: number; height: number };
  zIndex: number;
};
```

This model is regenerated from the scene. It exists to make UI work easier: timelines need flat layer rows, inspectors need selected-node metadata, and canvas handles need resolved boxes. It should not be saved as the video document.

## Patch Mapping

Common manual operations should map directly to RFC 0001 patch ops:

| User action | Patch op |
| --- | --- |
| move or resize node | `setStyle` |
| edit text | `setText` |
| trim or move in timeline | `retime` |
| apply preset animation | `setAnimations` |
| add media to canvas | `setAsset` + `insertNode` |
| delete layer | `removeNode` |
| reorder layer | `moveNode` or `setStyle` with `zIndex` |
| change composition size/duration | `setSceneMeta` |

Undo can be built as inverse patches or as scene snapshots at first. Start with snapshots if it keeps the reference app moving; graduate to inverse patches when patch history becomes a public feature.

## Implementation Sequence

### Slice 1 - Editor Shell

- Rename or evolve `apps/chat` into the reference editor app.
- Keep chat, preview, JSON, and export working.
- Add collapsible chat.
- Add empty layer panel and inspector regions.
- No manual mutation yet.

### Slice 2 - Scene Selection And Layers

- Derive flat layers from scene nodes.
- Select layers from the list.
- Select visible nodes from the canvas where possible.
- Show selected node metadata in inspector.
- Keep JSON and preview synchronized.

### Slice 3 - Inspector Patches

- Implement inspector edits for text, timing, position, size, color, opacity.
- Every inspector change applies a `ScenePatch`.
- Add undo/redo.
- Show last patch in a debug panel.

### Slice 4 - Canvas Handles

- Draw selection outlines over the preview.
- Drag to move absolute nodes.
- Resize absolute nodes.
- Commit each interaction as patch ops.

### Slice 5 - Compact Timeline

- Render flat layer blocks.
- Scrub playhead.
- Drag to retime.
- Resize edges to change duration.
- Split at playhead.
- Add snapping.

### Slice 6 - Captions And Media

- Add transcript/word-timing input.
- Generate caption nodes through presets.
- Edit caption text and style.
- Add local image/video/audio assets from the app.

### Slice 7 - Chat Fusion

- Pass selected ids and selected time range into the chat API.
- Make follow-up prompts produce scoped patches.
- Add accept/revert for assistant patches.
- Improve repair loop and diagnostics.

## Open-Source Boundary

The open-source project should own:

- scene schema
- renderer/player/export packages
- patch API
- reference chat + edit app
- simple local media handling
- examples, docs, tests, and eval harness

Downstream products can own:

- accounts
- paid project storage
- team workflows
- cloud rendering
- proprietary template catalogs
- complex product-specific integrations

This boundary keeps MotionForge useful as an open-source engine while still showing a complete, credible editor experience.
