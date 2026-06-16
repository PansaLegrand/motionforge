# create-motionforge

Starter project generator for MotionForge.

## Usage

```sh
pnpm create motionforge hello-video
cd hello-video
pnpm install
pnpm validate
pnpm dev
```

The generated project uses `@motionforge/authoring` for scene source and `@motionforge/cli` for validation, scene printing, Studio preview, and browser MP4 export.

The starter intentionally keeps the authored project small:

```txt
src/video.ts
public/assets/logo.svg
package.json
tsconfig.json
```

Run `pnpm dev` to open MotionForge Studio for `src/video.ts`.

Add images, video, audio, fonts, or Lottie JSON under `public/assets`. Reference them in source with `publicAsset("assets/file.ext")`; the generated scene JSON stores the fetchable URL `/assets/file.ext`.

## License

MIT
