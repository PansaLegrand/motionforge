import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { StudioServerResult } from "./studio.js";
import { executeCli } from "./index.js";

const openServers: StudioServerResult[] = [];

afterEach(async () => {
  await Promise.all(openServers.splice(0).map((server) => server.close()));
});

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

      expect(result, result.stderr).toMatchObject({ exitCode: 0 });
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

  it("starts a studio server for a scene module", async () => {
    const dir = await tempDir();

    try {
      const scenePath = join(dir, "scene.json");
      await writeFile(scenePath, JSON.stringify(validScene()));

      const result = await executeCli([
        "dev",
        scenePath,
        "--host",
        "127.0.0.1",
        "--port",
        "0",
      ]);

      expect(result, result.stderr).toMatchObject({ exitCode: 0 });
      expect(result.stdout).toContain("MotionForge Studio running at");
      expect(result.stdout).toContain(scenePath);
      expect(result.close).toBeTypeOf("function");

      const match = result.stdout.match(/(http:\/\/127\.0\.0\.1:\d+\/)/);
      expect(match?.[1]).toBeTruthy();
      openServers.push({
        close: result.close ?? (async () => {}),
        sceneModulePath: scenePath,
        url: match?.[1] ?? "",
      });

      const response = await fetch(`${match?.[1]}__motionforge/scene`);
      const payload = (await response.json()) as {
        ok: boolean;
        scene?: { width?: number };
      };

      expect(payload).toMatchObject({ ok: true, scene: { width: 1080 } });

      const html = await (await fetch(match?.[1] ?? "")).text();
      expect(html).toContain(
        "/@id/__x00__virtual:motionforge-studio-client",
      );

      const clientResponse = await fetch(
        `${match?.[1]}@id/__x00__virtual:motionforge-studio-client`,
      );
      const client = await clientResponse.text();

      expect(clientResponse.status, client).toBe(200);
      expect(client).toContain("createPlayer");
      expect(client).not.toContain('from "@motionforge/player"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
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
