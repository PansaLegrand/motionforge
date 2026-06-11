// Writes every shared showcase scene to examples/generated/*.json.
// Run after `pnpm build`:
//   node examples/generate-showcase.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { showcaseScenes } from "../packages/showcase/dist/index.js";
import { validateScene } from "../packages/schema/dist/index.js";

const outDir = resolve("examples/generated");
await mkdir(outDir, { recursive: true });

for (const entry of showcaseScenes) {
  const result = validateScene(entry.scene);

  if (!result.ok) {
    console.error(`${entry.id}: ${result.errors.join("\n")}`);
    process.exitCode = 1;
    continue;
  }

  const outPath = resolve(outDir, `${entry.id}.json`);
  await writeFile(outPath, `${JSON.stringify(entry.scene, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}
