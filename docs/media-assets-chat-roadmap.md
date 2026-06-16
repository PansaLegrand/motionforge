# Media Assets + Chat Roadmap

**Status:** implementation plan drafted 2026-06-16

This roadmap extends the chat + manual editor into a media-aware workspace. The goal is not just "upload files" or "chat about files"; the goal is for a user to introduce videos, images, and audio, then describe concrete edits in chat and see those edits become visible, editable scene operations.

## North-Star Flow

User uploads two videos.

The asset shelf shows:

- `Video 1` thumbnail, filename, duration, dimensions
- `Video 2` thumbnail, filename, duration, dimensions

User types:

```txt
Put video one first, only keep it from 5 to 10 seconds, then video two full.
Write text "I love this" at the second video on top.
```

The app creates a sequence:

1. `Video 1` as a video node from `00:05` to `00:10`
2. `Video 2` as the next video node for its full duration
3. A text overlay node reading `I love this`, aligned top-center during `Video 2`

The preview, compact timeline, layers, inspector, JSON, undo/redo, and export all work from the resulting canonical `Scene`.

## Product Rule

The canonical video remains a MotionForge `Scene`.

Media-aware chat and manual operations must converge on the existing patch path:

```txt
upload/import asset -> local asset catalog
chat instruction + asset context -> ScenePatch or complete Scene
manual media action -> ScenePatch
ScenePatch -> applyScenePatch -> Scene
```

The asset catalog may hold UI-only metadata such as filenames, object URLs, thumbnail URLs, waveform peaks, and upload state. The scene document only stores renderable `scene.assets` entries and nodes.

## UX Shape

Add a fourth editor panel: **Assets**.

Default desktop layout remains:

- tool rail
- active side panel
- central preview
- compact timeline

The tool rail panels become:

- Assistant
- Assets
- Layers
- Inspector

The Assets panel is the local media shelf. Each asset card should show the information a user needs to reference the file confidently:

- thumbnail or type icon
- stable display label: `Video 1`, `Image 1`, `Audio 1`
- filename
- duration for video/audio
- dimensions for image/video
- usage state: unused, used in scene, selected

The chat composer should support both natural references and explicit mentions:

- Natural: `video one`, `the second clip`, `the logo image`
- Explicit: `@Video 1`, `@beach.mp4`, `@Video 1[00:05-00:10]`
- Action shortcuts later: `/trim`, `/caption`, `/overlay`, `/sequence`, `/export`

Start with explicit `@` mention support in the prompt context and UI affordance. `/` commands are useful, but they are not required for the first vertical slice.

## Interaction Decisions

### 1. Use `@` For Asset References

`@` should insert an asset chip into the composer. The chip should display the asset label and, where space allows, a tiny thumbnail or type icon.

Text serialization can stay simple in v0:

```txt
@Video 1
@Video 1[00:05-00:10]
@voiceover.wav
```

The request to the model should not rely on parsing ambiguous prose alone. It should include an asset manifest with ids, aliases, labels, filenames, media types, duration, dimensions, and whether each asset is already used in the scene.

### 2. Keep "Video 1" Aliases

The app should assign stable session aliases in upload order:

- `video-1` display label `Video 1`
- `video-2` display label `Video 2`
- `image-1` display label `Image 1`
- `audio-1` display label `Audio 1`

Aliases make voice-like prompts feel natural, and they give the local fallback a deterministic way to resolve "video one" before the LLM path is strong.

### 3. Show An Editable Operation Plan

For media-heavy edits, the assistant response should include an operation summary before or after applying the patch:

```txt
Sequence
1. Video 1: 00:05-00:10
2. Video 2: full duration
   Text: "I love this", top-center
```

The first implementation can apply immediately and show the plan as an explanation plus undo. A later safety pass can add `Preview patch`, `Apply`, and `Revert` for destructive or ambiguous edits.

### 4. Manual And Chat Controls Share Fields

Manual controls should expose the same media-specific fields the chat can edit:

- asset selection
- scene start frame
- node duration
- source start time: `videoStartTime` or `audioStartTime`
- playback rate
- volume
- object fit and object position

This keeps media operations explainable and makes chat output easy to fix by hand.

## Data Model

### Local Asset Catalog

Add a local UI model outside the canonical scene:

```ts
type LocalMediaAsset = {
  id: string;
  sceneAssetId: string;
  type: "image" | "video" | "audio";
  file: File;
  objectUrl: string;
  label: string;
  aliases: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  waveformPeaks?: number[];
  status: "probing" | "ready" | "error";
  error?: string;
};
```

Notes:

- `id` is the chat/editor handle.
- `sceneAssetId` is the renderable asset id used in `scene.assets`.
- `objectUrl` is session-local and must be revoked when the asset is removed or the session ends.
- `File` and UI metadata are not stored in `Scene`.
- Persistence can later replace `objectUrl` with file handles, IndexedDB blobs, or remote URLs.

### Asset Manifest Sent To Chat

The chat API should receive a compact manifest, not raw `File` objects:

```ts
type ChatMediaAssetManifestItem = {
  id: string;
  sceneAssetId: string;
  type: "image" | "video" | "audio";
  label: string;
  aliases: string[];
  fileName: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  alreadyInScene: boolean;
};
```

The system prompt should tell the model:

- refer to uploaded assets only by `sceneAssetId`
- create `setAsset` ops before inserting nodes that use unused assets
- create `video` nodes for video assets, `img` nodes for image assets, and `audio` nodes for audio assets
- convert seconds to integer frames using `scene.fps`
- use `videoStartTime` for video source trim and `audioStartTime` for audio source trim
- when sequencing clips, set each node's `from` and `duration` so they do not overlap unless the user asks for overlap

### Media Operation Plan

The visible plan can be a derived UI structure:

```ts
type MediaOperationPlan = {
  summary: string;
  steps: Array<
    | {
        type: "sequence-clip";
        assetId: string;
        label: string;
        sourceStartSeconds: number;
        sourceEndSeconds?: number;
        sceneStartFrame: number;
        durationFrames: number;
      }
    | {
        type: "text-overlay";
        text: string;
        targetAssetId?: string;
        fromFrame: number;
        durationFrames: number;
        position: "top" | "center" | "bottom" | "custom";
      }
    | {
        type: "audio-placement";
        assetId: string;
        label: string;
        sourceStartSeconds: number;
        sceneStartFrame: number;
        durationFrames: number;
        volume: number;
      }
  >;
};
```

This plan is not the source of truth. It is an explanation of the patch and a bridge to editable UI controls.

## Implementation Slices

Each slice should land with focused tests and a `docs/progress.md` entry.

### Slice M1 - Asset Catalog And Shelf ✅

**Goal:** Users can upload local image/video/audio files and see them as stable assets in the editor.

Code targets:

- `apps/chat/components/editor/types.ts`
- `apps/chat/components/editor/editor-workspace.tsx`
- `apps/chat/components/motionforge-chat-app.tsx`
- new `apps/chat/lib/media/assets.ts`
- new `apps/chat/lib/media/assets.test.ts`

Tasks:

- Add `EditorPanel` value `"assets"`.
- Add Assets icon to `ToolRail`.
- Add `AssetsPanel` with file input/drop zone and asset cards.
- Create `LocalMediaAsset` helpers for id/label/alias generation.
- Probe images for width/height.
- Probe videos for duration and dimensions using an offscreen `<video>`.
- Probe audio for duration using an offscreen `<audio>` or `AudioContext` where practical.
- Generate a first video thumbnail from a safe early frame.
- Revoke object URLs when assets are removed or the app session resets.

Done when:

- Uploading two videos shows `Video 1` and `Video 2` with duration metadata.
- Uploading image/audio files gives sensible cards.
- Removing/resetting a session releases object URLs.
- Unit tests cover label/alias/id generation and manifest creation.

### Slice M2 - Manual Add-To-Scene ✅

**Goal:** Users can insert an uploaded asset into the scene without chat.

Code targets:

- `apps/chat/components/motionforge-chat-app.tsx`
- `apps/chat/components/editor/editor-workspace.tsx`
- `apps/chat/lib/media/insert.ts`
- `apps/chat/lib/media/insert.test.ts`
- `apps/chat/lib/editor/layers.ts`

Tasks:

- Add an asset-card action to insert the asset into the scene.
- If no scene exists, create a default scene sized from the first visual asset where appropriate.
- Apply a patch with `setAsset` and `insertNode`.
- Insert videos/images as bounded full-frame visual nodes using `objectFit: "cover"` by default.
- Insert audio as an `audio` node with no visual bounds.
- Select the inserted layer and show the generated patch.
- Ensure the compact timeline shows inserted media nodes.

Done when:

- A video upload can be inserted, previewed, played with sound if present, and exported.
- An image upload can be inserted and exported.
- An audio upload can be inserted and contributes to preview/export audio.
- Undo removes the inserted node and returns the previous scene.

### Slice M3 - Media Inspector Controls ✅

**Goal:** Manual editing exposes media timing and source trim controls.

Code targets:

- `apps/chat/lib/editor/layers.ts`
- `apps/chat/lib/editor/inspector-patches.ts`
- `apps/chat/lib/editor/inspector-patches.test.ts`
- `apps/chat/components/editor/editor-workspace.tsx`

Tasks:

- Project `assetId`, `videoStartTime`, `audioStartTime`, `playbackRate`, `volume`, `objectFit`, and `objectPosition` into `EditorLayer`.
- Add inspector fields for video/audio source start time.
- Add inspector fields for playback rate and volume where valid.
- Add inspector controls for object fit and object position on image/video nodes.
- Map every edit to patch ops: `setStyle`, `retime`, or `setNodeProps`.

Important implementation note:

The patch vocabulary now includes a narrowly scoped `setNodeProps` op for existing scalar node fields: `assetId`, `videoStartTime`, `audioStartTime`, `playbackRate`, and `volume`. It is not a generic mutation escape hatch; final scene validation still enforces node-type rules.

Done when:

- A user can trim the source start of a video/audio node by hand.
- A user can adjust video/audio volume by hand.
- A user can change image/video object fit.
- All edits are undoable and appear in the last-patch panel.

### Slice M4 - Chat Asset Context ✅

**Goal:** Chat understands what files are available and can reference them by stable ids.

Code targets:

- `apps/chat/app/api/chat/route.ts`
- `apps/chat/lib/ai/prompt.ts`
- `apps/chat/lib/ai/prompt.test.ts`
- `apps/chat/components/motionforge-chat-app.tsx`
- new `apps/chat/lib/media/manifest.ts`
- new `apps/chat/lib/media/mentions.ts`

Tasks:

- Include `mediaAssets` in the chat API request body.
- Build and send a compact asset manifest.
- Update `buildMotionforgeSystemPrompt()` to include media asset rules.
- Update user prompt construction to include available asset manifest.
- Add deterministic alias resolution for natural phrases like `video one`.
- Add a simple `@` mention parser that maps typed mentions to asset ids.
- Display selected/available assets near the composer so users know what chat can see.

Done when:

- Sending a prompt with two uploaded videos includes a manifest in the API request.
- The model/local fallback can distinguish `Video 1` from `Video 2`.
- Tests cover mention parsing and alias resolution.

### Slice M5 - Local Media Instruction Compiler V0 ✅

**Goal:** The north-star prompt works without relying on a remote model.

Code targets:

- `apps/chat/lib/motionforge/local-agent.ts`
- new `apps/chat/lib/media/instruction-compiler.ts`
- new `apps/chat/lib/media/instruction-compiler.test.ts`

Tasks:

- Add a deterministic compiler for the first common media intent:
  - sequence two or more videos/images
  - trim a video by source seconds
  - keep another video full length
  - add quoted text to a target clip
  - place text top/center/bottom
- Convert source seconds to frames using the scene fps.
- Generate `setAsset`, `insertNode`, `retime`, `setSceneMeta`, and text overlay patch ops.
- Generate a `MediaOperationPlan` for assistant explanation.
- Preserve the current local fallback behavior when no media intent is detected.

Done when:

- With two uploaded videos, the exact north-star prompt creates a valid scene/patch locally.
- The assistant message explains the sequence and overlay.
- Preview, timeline, layers, inspector, undo, JSON, and export all reflect the resulting scene.

### Slice M6 - Model Path For Media Edits ✅

**Goal:** The LLM path can perform the same operations as the local compiler, with repair.

Code targets:

- `apps/chat/app/api/chat/route.ts`
- `apps/chat/lib/ai/prompt.ts`
- `apps/chat/lib/motionforge/local-agent.ts`
- `tools/agent-eval/src/cases.ts`
- `tools/agent-eval/src/score.ts`

Tasks:

- Teach the prompt with media examples using uploaded asset manifests.
- Add validation/repair around model patches that reference missing assets or invalid ids.
- Add eval cases for:
  - two-video sequence with one trim
  - image background plus text overlay
  - audio bed under visual scene
  - ambiguous reference requiring safest interpretation
- Keep local compiler as fallback when the model fails.

Done when:

- The model path and local path both satisfy the north-star flow.
- Eval records pass/fail numbers for media cases.
- Model errors surface as readable diagnostics and do not corrupt the scene.

### Slice M7 - Operation Plan UI ✅

**Goal:** Media chat edits are visible as editable operations, not mysterious JSON changes.

Code targets:

- `apps/chat/components/editor/types.ts`
- `apps/chat/components/editor/editor-workspace.tsx`
- `apps/chat/components/motionforge-chat-app.tsx`
- new `apps/chat/lib/media/plan.ts`
- new `apps/chat/lib/media/plan.test.ts`

Tasks:

- Add optional plan data to assistant messages.
- Render media plans as compact operation rows in chat.
- Allow selecting a plan step to select the affected layer on the timeline/layers panel.
- Use the existing undo control for revert until scene history records semantic edit sources cleanly.
- Later, add a pre-apply confirmation state for risky edits.

Done when:

- The north-star prompt yields an operation plan visible in chat.
- Clicking `Video 1: 00:05-00:10` selects the corresponding timeline block.
- Undo/revert is obvious and reliable.

### Slice M8 - Asset Timeline Polish

**Goal:** Media assets are easy to inspect and trim visually.

Code targets:

- `apps/chat/components/editor/editor-workspace.tsx`
- `apps/chat/lib/editor/time.ts`
- `apps/chat/lib/editor/time.test.ts`
- new `apps/chat/lib/media/thumbnails.ts`
- new `apps/chat/lib/media/waveform.ts`

Tasks:

- Show thumbnails inside video/image timeline blocks.
- Show waveform preview for audio blocks if inexpensive enough.
- Add source-trim affordance in timeline or inspector.
- Add snapping around clip boundaries.
- Preserve existing split behavior that offsets `videoStartTime`/`audioStartTime`.

Done when:

- A user can visually identify clips in the timeline.
- Trimming source material is understandable without reading JSON.
- Existing timeline drag, resize, split, and undo remain stable.

### Slice M9 - Large File And Session Reality Check

**Goal:** The local browser app behaves honestly with real phone footage.

Code targets:

- `apps/chat/components/motionforge-chat-app.tsx`
- `apps/chat/lib/media/assets.ts`
- `docs/benchmarks.md`
- `docs/progress.md`

Tasks:

- Test 100-500 MB phone videos through upload, preview, sequence, export.
- Track where full-file fetch/decode becomes painful.
- Add user-facing readiness/errors for unsupported formats, decode failures, memory pressure, and missing WebCodecs.
- Decide whether streaming-source support is forced now or can remain deferred.

Done when:

- Real footage behavior is documented.
- The UI fails clearly when the browser cannot handle an asset.
- Object URL and decoder lifetimes do not leak across reset/remove flows.

## First Vertical Slice

The fastest useful demo should be:

1. Upload two videos.
2. See them as `Video 1` and `Video 2` in Assets.
3. Type the north-star prompt.
4. Get a valid scene with:
   - `Video 1` from source seconds 5-10
   - `Video 2` full length after it
   - text overlay `I love this` at top-center over `Video 2`
5. Preview with sound.
6. Undo.
7. Export MP4.

This vertical slice requires M1, M2 basics, M4 basics, and M5. M3 and M7 make it feel much better, but they can follow immediately after the demo path works.

## Testing Strategy

Use unit tests for deterministic helpers:

- asset id/label/alias generation
- manifest creation
- mention parsing
- alias resolution
- seconds-to-frame conversion
- media instruction compiler output
- operation-plan derivation

Use app/browser smoke tests for the real media path:

- upload two small fixture videos
- run the north-star prompt
- confirm layers/timeline reflect the sequence
- confirm preview renders nonblank frames for both clips
- confirm last patch contains expected ops
- export a short MP4 where supported

Use eval harness tests for model behavior:

- generation with uploaded media manifest
- patch edit with existing media nodes
- repair after missing asset id
- repair after invalid timing

## Open Questions

- Should the first chat media edit apply immediately with undo, or require explicit `Apply`? Recommendation: apply immediately for v0, then add pre-apply confirmation for destructive edits.
- Should uploaded object URLs be copied into `scene.assets` eagerly or only when used? Recommendation: only when used.
- Should asset aliases reset on session reset? Recommendation: yes, because object URLs are session-local.
- Should the `ScenePatch` vocabulary gain a generic node-field patch op? Recommendation: decide during M3. If media source fields cannot be edited through current ops, add a narrow, validated patch operation rather than bypassing patch application.
- Should `/` commands ship with the first slice? Recommendation: no. `@` asset references solve the immediate ambiguity problem; `/` commands can come after the core media flow is proven.
