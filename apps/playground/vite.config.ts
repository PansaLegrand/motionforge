import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset URLs so the build works at any static-host mount path.
  base: "./",
  test: {
    // The playground is exercised by the golden harness and Playwright E2E,
    // not unit tests; keep `pnpm -r test` green.
    passWithNoTests: true,
  },
});
