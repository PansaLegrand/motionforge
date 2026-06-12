# Getting started

Build a video in the browser in about five minutes: describe it as JSON, preview it on a canvas, export an MP4 — no server, no ffmpeg.

> Until the packages are on npm, consume them from this repo via a pnpm workspace or `pnpm link`. The API below is what will publish as `0.3.0`.

## 1. A scene is JSON

A **scene** is the whole video: size, frame rate, duration in frames, assets, and a tree of nodes. Nodes are styled boxes (`div`), text, images, video clips, or audio — think "tiny CSS subset on a canvas, with time".

```json
{
  "schemaVersion": 0,
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 90,
  "assets": {},
  "nodes": [
    {
      "id": "bg",
      "type": "div",
      "style": { "width": "100%", "height": "100%", "backgroundColor": "#101820" }
    },
    {
      "id": "title",
      "type": "text",
      "text": "Hello motionforge",
      "from": 0,
      "duration": 90,
      "style": {
        "position": "absolute", "left": 64, "right": 64, "top": 800,
        "fontSize": 72, "color": "#ffffff", "textAlign": "center",
        "textStroke": "6 #000000"
      },
      "animations": [
        {
          "kind": "keyframes",
          "property": "transform",
          "frames": [
            { "frame": 0, "value": "scale(0.8)" },
            { "frame": 12, "value": "scale(1)", "easing": "spring(0.3)" }
          ]
        }
      ]
    }
  ]
}
```

Three rules carry most of the model:

- **Time is integer frames.** A node exists for `[from, from + duration)` on its parent's timeline. No wall-clock seconds anywhere.
- **Animations are keyframes on style properties.** Numbers, colors, and matching transform lists tween; everything else steps. Easings: `linear`, `easeIn/Out/InOut`, `cubic-bezier(…)`, `spring(bounce)`.
- **Everything validates.** Unknown style properties are rejected with a message that says what to fix. `validateScene(json)` before rendering, always.

The full contract — every node type, every style property and its exact behavior — is [scene-format.md](../scene-format.md).

## 2. Preview it

```ts
import { createPlayer } from "@motionforge/player";

const canvas = document.querySelector("canvas")!;
canvas.width = scene.width;
canvas.height = scene.height;

const player = await createPlayer({
  context: canvas.getContext("2d")!,
  scene,           // your JSON — validated on create
  loop: true,
});

player.play();                                  // wall-clock-accurate playback
player.on("frame", (f) => updateScrubber(f));   // drive your UI
await player.seek(45);                          // jump anywhere, instantly
```

The player resolves assets (images, fonts, video clips) for you, or accepts pre-resolved ones if you want to share them with export.

## 3. Export an MP4

```ts
import { detectExportCapability, exportVideo } from "@motionforge/export";

if (detectExportCapability().videoEncoder) {
  const { blob } = await exportVideo({
    scene,
    onProgress: ({ frameIndex, totalFrames }) => setProgress(frameIndex / totalFrames),
  });
  // a real MP4 (H.264 + AAC where the browser supports it), encoded client-side
}
```

Export renders the exact same frames the player shows — rendering is a pure function of `(scene, frame)`, so preview is never a lie. Audio nodes are mixed into the file's audio track.

## 4. Don't hand-write animations — use presets

```ts
import { popIn, tiktokCaptions } from "@motionforge/presets";

// keyframes for any node:
node.animations = popIn({ durationInFrames: 12 });

// a whole caption track from ASR word timestamps — one container node, words as children:
const captionTrack = tiktokCaptions(
  [{ word: "never", startMs: 0, endMs: 280 }, { word: "gonna", startMs: 280, endMs: 520 }],
  { fps: 30 },
);
scene.nodes.push(captionTrack);
```

`tiktokCaptions` / `karaokeCaptions` produce the word-timed, stroked, pill-backgrounded caption styles you know from short-form video — as plain scene data you can inspect and tweak.

## 5. Media assets

```jsonc
"assets": {
  "clip":  { "id": "clip",  "type": "video", "src": "https://…/footage.mp4" },
  "logo":  { "id": "logo",  "type": "image", "src": "data:image/png;base64,…" },
  "voice": { "id": "voice", "type": "audio", "src": "https://…/voiceover.mp3" },
  "Inter-Bold": { "id": "Inter-Bold", "type": "font", "src": "https://…/inter-700.woff2" }
}
```

- `video` nodes reference a clip and can trim (`videoStartTime`, seconds) and retime (`playbackRate`). Decoding is frame-accurate — no `<video>`-element seeking.
- `font` assets register under their **asset id**; use `fontFamily: "Inter-Bold"`. One asset per family + weight.
- `audio` nodes place sound on the timeline (`volume`, `audioStartTime`); they're mixed at export.

## If you're an LLM (or building with one)

[llms.txt](../../llms.txt) is the compact contract written for you: mental model, hard rules, a complete valid scene, the exact implemented style list, and example validation errors. Generate scene JSON, run `validateScene`, read the errors, fix, repeat — the errors are written to converge that loop in one round trip.

## Run the playground

```bash
pnpm install && pnpm dev   # → http://localhost:5173
```

Three showcase scenes with scrubbing, playback, and one-click MP4 export — the same engine path your app will use.
