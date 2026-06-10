// Regenerates scene.schema.json from the built package. Runs as part of
// `pnpm build` so the committed artifact can never drift from the Zod schema.
import { writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sceneJsonSchema } from "../dist/index.js";

const outPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../scene.schema.json",
);

await writeFile(outPath, `${JSON.stringify(sceneJsonSchema(), null, 2)}\n`);
console.log(`wrote ${outPath}`);
