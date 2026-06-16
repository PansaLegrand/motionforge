import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { validateScene, type Scene } from "@motionforge/schema";

export type CliResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export type CliIo = {
  stdout: (value: string) => void;
  stderr: (value: string) => void;
};

type SceneExport = Scene | (() => Scene | Promise<Scene>) | Promise<Scene>;

const helpText = `motionforge

Usage:
  motionforge validate <scene-module>
  motionforge print <scene-module>

Scene modules may be .json, .js, .mjs, .cjs, .ts, .mts, or .cts files.
The default export may be a Scene, a function returning a Scene, or a Promise.
`;

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: (value) => process.stdout.write(value),
    stderr: (value) => process.stderr.write(value),
  },
): Promise<number> {
  const result = await executeCli(argv);

  if (result.stdout) {
    io.stdout(result.stdout);
  }

  if (result.stderr) {
    io.stderr(result.stderr);
  }

  return result.exitCode;
}

export async function executeCli(argv: string[]): Promise<CliResult> {
  const [command, modulePath, ...rest] = argv;

  if (!command || command === "--help" || command === "-h") {
    return { exitCode: 0, stdout: helpText, stderr: "" };
  }

  if (command !== "validate" && command !== "print") {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Unknown command "${command}".\n\n${helpText}`,
    };
  }

  if (!modulePath || rest.length > 0) {
    return {
      exitCode: 2,
      stdout: "",
      stderr: `Usage error: expected exactly one scene module path.\n\n${helpText}`,
    };
  }

  try {
    const sceneInput = await loadSceneModule(modulePath);
    const result = validateScene(sceneInput);

    if (!result.ok) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: formatValidationErrors(modulePath, result.errors),
      };
    }

    if (command === "print") {
      return {
        exitCode: 0,
        stdout: `${JSON.stringify(result.scene, null, 2)}\n`,
        stderr: "",
      };
    }

    return {
      exitCode: 0,
      stdout: `Valid MotionForge scene: ${modulePath}\n`,
      stderr: "",
    };
  } catch (error) {
    return {
      exitCode: 1,
      stdout: "",
      stderr: `${error instanceof Error ? error.message : String(error)}\n`,
    };
  }
}

export async function loadSceneModule(modulePath: string): Promise<unknown> {
  const absolutePath = resolve(modulePath);
  const extension = extname(absolutePath);

  if (extension === ".json") {
    return JSON.parse(await readFile(absolutePath, "utf8")) as unknown;
  }

  if (isTypeScriptExtension(extension)) {
    await import("tsx/esm");
  }

  const imported = (await import(
    `${pathToFileURL(absolutePath).href}?t=${Date.now()}`
  )) as {
    default?: SceneExport;
    scene?: SceneExport;
  };
  const exported = imported.default ?? imported.scene;

  if (exported === undefined) {
    throw new Error(
      `Scene module "${modulePath}" must export a default scene or named "scene".`,
    );
  }

  const value = typeof exported === "function" ? exported() : exported;
  return await value;
}

function formatValidationErrors(modulePath: string, errors: string[]) {
  return [
    `Invalid MotionForge scene: ${modulePath}`,
    ...errors.map((error) => `- ${error}`),
    "",
  ].join("\n");
}

function isTypeScriptExtension(extension: string) {
  return extension === ".ts" || extension === ".mts" || extension === ".cts";
}
