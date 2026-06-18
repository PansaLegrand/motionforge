import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // Relative asset URLs so the build works at any static-host mount path.
  base: "./",
  resolve: {
    alias: {
      "@motionforge/presets/catalog": fileURLToPath(
        new URL("../../packages/presets/src/catalog.ts", import.meta.url),
      ),
    },
  },
  test: {
    // The playground is exercised by the golden harness and Playwright E2E,
    // not unit tests; keep `pnpm -r test` green.
    passWithNoTests: true,
  },
});
