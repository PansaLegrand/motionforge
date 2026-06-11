# Showcase

These scenes are the public proof that motionforge's JSON-to-video pipeline is useful today. They live in `@motionforge/showcase`, feed the playground scene picker, and can be exported to JSON under `examples/generated`.

## Render Commands

```sh
pnpm build
pnpm showcase:generate
pnpm --filter @motionforge/golden run example examples/generated/tiktok-captions.json out/tiktok-captions.mp4 60
```

The trailing frame numbers write poster PNGs next to the MP4.

## Scenes

| Scene | Poster | What It Proves |
| --- | --- | --- |
| Engine Intro | <img src="assets/showcase/intro.png" alt="Engine intro" width="180"> | Gradients, image assets, text layout, opacity keyframes, MP4 export |
| TikTok Captions | <img src="assets/showcase/tiktok-captions.png" alt="TikTok captions" width="180"> | `tiktokCaptions()` compiles ASR timestamps into timed caption nodes with spring transforms, text stroke, and measured fitted pills |
| Karaoke Captions | <img src="assets/showcase/karaoke-captions.png" alt="Karaoke captions" width="180"> | `karaokeCaptions()` keeps a full line visible while per-word color keyframes track spoken timestamps |

## Source

- Shared scene definitions: [packages/showcase/src/index.ts](../packages/showcase/src/index.ts)
- Generated JSON: [examples/generated](../examples/generated)
- Playground: [apps/playground](../apps/playground)

## Why This Matters

The showcase is deliberately data-first: each demo is a serializable scene document, not a React component or a browser screenshot script. Preview and export use the same Canvas2D renderer, so the playground frame and exported MP4 frame come from the same pipeline.
