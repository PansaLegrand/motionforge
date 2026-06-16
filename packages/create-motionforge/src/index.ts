import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

export type CreateMotionforgeOptions = {
  cwd?: string;
  force?: boolean;
};

export type CreateMotionforgeResult = {
  projectName: string;
  projectDir: string;
  files: string[];
};

const packageVersion = "0.3.0";

export async function createMotionforgeProject(
  targetDir: string,
  options: CreateMotionforgeOptions = {},
): Promise<CreateMotionforgeResult> {
  const cwd = options.cwd ?? process.cwd();
  const projectDir = resolve(cwd, targetDir);
  const projectName = sanitizePackageName(basename(projectDir));

  await ensureWritableProjectDir(projectDir, options.force ?? false);

  const files = projectFiles(projectName);

  for (const [filePath, contents] of files) {
    const absolutePath = join(projectDir, filePath);
    await mkdir(resolve(absolutePath, ".."), { recursive: true });
    await writeFile(absolutePath, contents);
  }

  return {
    projectName,
    projectDir,
    files: files.map(([filePath]) => filePath),
  };
}

export function helpText() {
  return `create-motionforge

Usage:
  pnpm create motionforge <project-name>
  npm create motionforge@latest <project-name>

Options:
  --force    Write into a non-empty directory.
`;
}

export async function runCreateMotionforgeCli(argv: string[]) {
  const targetDir = argv.find((arg) => !arg.startsWith("-"));
  const force = argv.includes("--force");

  if (!targetDir || argv.includes("--help") || argv.includes("-h")) {
    const exitCode = targetDir ? 0 : 2;
    const stream = exitCode === 0 ? process.stdout : process.stderr;
    stream.write(helpText());
    return exitCode;
  }

  try {
    const result = await createMotionforgeProject(targetDir, { force });
    process.stdout.write(formatSuccess(result));
    return 0;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
}

function projectFiles(projectName: string): Array<[string, string]> {
  return [
    ["package.json", packageJson(projectName)],
    ["tsconfig.json", tsconfigJson()],
    ["index.html", indexHtml()],
    ["src/video.ts", videoTs()],
    ["src/main.ts", mainTs()],
    ["src/style.css", styleCss()],
  ];
}

async function ensureWritableProjectDir(projectDir: string, force: boolean) {
  await mkdir(projectDir, { recursive: true });
  const entries = await readdir(projectDir);

  if (entries.length > 0 && !force) {
    throw new Error(
      `Directory "${projectDir}" is not empty. Choose a new directory or pass --force.`,
    );
  }

  const info = await stat(projectDir);

  if (!info.isDirectory()) {
    throw new Error(`Target "${projectDir}" is not a directory.`);
  }
}

function sanitizePackageName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "motionforge-video";
}

function formatSuccess(result: CreateMotionforgeResult) {
  return [
    `Created MotionForge project in ${result.projectDir}`,
    "",
    "Next steps:",
    `  cd ${result.projectDir}`,
    "  pnpm install",
    "  pnpm validate",
    "  pnpm dev",
    "",
  ].join("\n");
}

function packageJson(projectName: string) {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "0.0.0",
      private: true,
      type: "module",
      scripts: {
        dev: "vite --host 127.0.0.1 --port 5173",
        validate: "motionforge validate src/video.ts",
        print: "motionforge print src/video.ts",
        build: "tsc -p tsconfig.json && vite build",
      },
      dependencies: {
        "@motionforge/authoring": `^${packageVersion}`,
        "@motionforge/cli": `^${packageVersion}`,
        "@motionforge/export": `^${packageVersion}`,
        "@motionforge/player": `^${packageVersion}`,
        vite: "^7.3.5",
      },
      devDependencies: {
        typescript: "^5.8.3",
      },
    },
    null,
    2,
  )}\n`;
}

function tsconfigJson() {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["src"],
    },
    null,
    2,
  )}\n`;
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MotionForge Starter</title>
  </head>
  <body>
    <main>
      <section class="preview-shell">
        <canvas id="preview" width="1080" height="1920"></canvas>
      </section>
      <section class="controls">
        <h1>MotionForge Starter</h1>
        <p id="status">Loading preview...</p>
        <div class="actions">
          <button id="play" type="button">Play</button>
          <button id="export" type="button">Export MP4</button>
        </div>
      </section>
    </main>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`;
}

function videoTs() {
  return `import {
  bg,
  fadeUp,
  makeScene,
  seconds,
  textBlock,
  title,
} from "@motionforge/authoring";

export default makeScene({
  size: "portrait",
  fps: 30,
  duration: seconds(5),
  children: [
    bg("#0f172a"),
    title("Hello MotionForge", {
      at: seconds(0.7),
      duration: seconds(3.5),
      enter: fadeUp(),
    }),
    textBlock("Write deterministic video as TypeScript data.", {
      at: seconds(1.4),
      duration: seconds(3),
      enter: fadeUp({ delay: 6 }),
    }),
  ],
});
`;
}

function mainTs() {
  return `import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import scene from "./video";
import "./style.css";

const canvas = document.querySelector<HTMLCanvasElement>("#preview");
const status = document.querySelector<HTMLParagraphElement>("#status");
const playButton = document.querySelector<HTMLButtonElement>("#play");
const exportButton = document.querySelector<HTMLButtonElement>("#export");

if (!canvas || !status || !playButton || !exportButton) {
  throw new Error("Starter DOM is missing required elements.");
}

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas2D is unavailable.");
}

let player: Player | null = null;

async function load() {
  canvas.width = scene.width;
  canvas.height = scene.height;
  player?.dispose();
  player = await createPlayer({ context, scene, loop: true });
  status.textContent = \`\${scene.width}x\${scene.height} · \${scene.fps}fps · \${(scene.duration / scene.fps).toFixed(1)}s\`;
  exportButton.disabled = !detectExportCapability().videoEncoder;
  exportButton.title = exportButton.disabled
    ? "MP4 export needs WebCodecs VideoEncoder. Try desktop Chrome or Edge."
    : "Export MP4";
}

playButton.addEventListener("click", () => {
  if (!player) return;

  if (player.playing) {
    player.pause();
    playButton.textContent = "Play";
  } else {
    void player.play();
    playButton.textContent = "Pause";
  }
});

exportButton.addEventListener("click", async () => {
  if (exportButton.disabled) return;

  exportButton.disabled = true;
  status.textContent = "Exporting MP4...";

  try {
    const { blob } = await exportVideo({
      scene,
      onProgress: ({ frameIndex, totalFrames }) => {
        status.textContent = \`Exporting \${frameIndex + 1}/\${totalFrames}\`;
      },
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "motionforge-starter.mp4";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    status.textContent = "Export complete.";
  } finally {
    exportButton.disabled = !detectExportCapability().videoEncoder;
  }
});

void load();
`;
}

function styleCss() {
  return `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  background: #e5e7eb;
  color: #111827;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
}

main {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(260px, 420px) minmax(280px, 1fr);
  gap: 32px;
  align-items: center;
  padding: 32px;
}

.preview-shell {
  justify-self: end;
  max-height: calc(100vh - 64px);
  aspect-ratio: 9 / 16;
  overflow: hidden;
  border-radius: 12px;
  background: #111827;
  box-shadow: 0 24px 72px rgb(15 23 42 / 24%);
}

canvas {
  display: block;
  height: 100%;
  width: 100%;
}

.controls {
  max-width: 520px;
}

h1 {
  margin: 0 0 12px;
  font-size: 40px;
  line-height: 1;
}

p {
  margin: 0 0 24px;
  color: #4b5563;
}

.actions {
  display: flex;
  gap: 12px;
}

button {
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: #111827;
  color: white;
  cursor: pointer;
  font: inherit;
  font-weight: 700;
  padding: 0 16px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@media (max-width: 760px) {
  main {
    grid-template-columns: 1fr;
  }

  .preview-shell {
    justify-self: center;
    max-height: 62vh;
  }
}
`;
}
