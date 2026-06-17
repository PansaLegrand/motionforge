// Writes preset-gallery scene JSON used by docs thumbnails.
// Run after `pnpm build`:
//   node examples/generate-preset-gallery.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { presetGalleryScenes } from "../packages/showcase/dist/index.js";

const outDir = resolve("examples/generated/presets");
await mkdir(outDir, { recursive: true });

for (const entry of presetGalleryScenes) {
  const outPath = resolve(outDir, `${entry.id}.json`);
  await writeFile(outPath, `${JSON.stringify(entry.scene, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}
