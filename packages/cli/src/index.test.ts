import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { executeCli } from "./index.js";

describe("@motionforge/cli", () => {
  it("validates a JSON scene file", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "scene.json");
      await writeFile(scenePath, JSON.stringify(validScene()));

      await expect(executeCli(["validate", scenePath])).resolves.toEqual({
        exitCode: 0,
        stdout: `Valid MotionForge scene: ${scenePath}\n`,
        stderr: "",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("prints normalized scene JSON from a JavaScript scene module", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "video.mjs");
      await writeFile(
        scenePath,
        `export default () => (${JSON.stringify(validScene())});\n`,
      );

      const result = await executeCli(["print", scenePath]);
      const printed = JSON.parse(result.stdout) as unknown;

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      expect(printed).toMatchObject({
        schemaVersion: 0,
        width: 1080,
        height: 1920,
        fps: 30,
        duration: 90,
        assets: {},
        nodes: [],
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("reports validation errors with a non-zero exit code", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "bad.json");
      await writeFile(
        scenePath,
        JSON.stringify({
          schemaVersion: 0,
          width: 1080,
          height: 1920,
          fps: 30,
          duration: 90,
          nodes: [{ id: "title", type: "text" }],
        }),
      );

      const result = await executeCli(["validate", scenePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toBe("");
      expect(result.stderr).toContain(`Invalid MotionForge scene: ${scenePath}`);
      expect(result.stderr).toContain("Text nodes require a `text` string.");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("loads TypeScript scene modules through the CLI loader", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "video.ts");
      await writeFile(
        scenePath,
        [
          "export default {",
          "  schemaVersion: 0,",
          "  width: 1080,",
          "  height: 1920,",
          "  fps: 30,",
          "  duration: 90,",
          "  nodes: [],",
          "};",
          "",
        ].join("\n"),
      );

      await expect(executeCli(["validate", scenePath])).resolves.toMatchObject({
        exitCode: 0,
        stderr: "",
      });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("explains incorrect command usage", async () => {
    await expect(executeCli(["unknown"])).resolves.toMatchObject({
      exitCode: 2,
      stdout: "",
    });
    await expect(executeCli(["validate"])).resolves.toMatchObject({
      exitCode: 2,
      stdout: "",
    });
  });
});

function validScene() {
  return {
    schemaVersion: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 90,
    nodes: [],
  };
}

async function tempDir() {
  return await mkdtemp(join(tmpdir(), "motionforge-cli-"));
}
