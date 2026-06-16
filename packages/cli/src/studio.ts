import type { ServerResponse } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateScene } from "@motionforge/schema";
import { createServer, type Plugin } from "vite";
import { loadSceneModule } from "./loader.js";

export type StudioServerOptions = {
  sceneModulePath: string;
  host?: string;
  port?: number;
};

export type StudioServerResult = {
  url: string;
  sceneModulePath: string;
  close: () => Promise<void>;
};

export async function createStudioServer(
  options: StudioServerOptions,
): Promise<StudioServerResult> {
  const sceneModulePath = resolve(options.sceneModulePath);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 5173;
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    resolve: {
      alias: resolveStudioRuntimeAliases(),
    },
    server: {
      host,
      port,
      strictPort: false,
    },
    plugins: [studioPlugin(sceneModulePath)],
  });

  await server.listen();

  const address = server.resolvedUrls?.local[0] ?? `http://${host}:${port}/`;

  return {
    url: address,
    sceneModulePath,
    close: async () => {
      await server.close();
    },
  };
}

function resolveStudioRuntimeAliases() {
  return {
    "@motionforge/export": resolveStudioRuntimePackage(
      "@motionforge/export",
      "packages/export/src/index.ts",
    ),
    "@motionforge/player": resolveStudioRuntimePackage(
      "@motionforge/player",
      "packages/player/src/index.ts",
    ),
    "@motionforge/renderer-canvas2d": resolveStudioRuntimePackage(
      "@motionforge/renderer-canvas2d",
      "packages/renderer-canvas2d/src/index.ts",
    ),
    "@motionforge/schema": resolveStudioRuntimePackage(
      "@motionforge/schema",
      "packages/schema/src/index.ts",
    ),
  };
}

function resolveStudioRuntimePackage(specifier: string, workspacePath: string) {
  const resolver = (import.meta as { resolve?: (specifier: string) => string })
    .resolve;

  if (resolver) {
    try {
      return fileURLToPath(resolver(specifier));
    } catch {
      // Fall through to the monorepo source path used by Vitest/local DX.
    }
  }

  return fileURLToPath(new URL(`../../../${workspacePath}`, import.meta.url));
}

function studioPlugin(sceneModulePath: string): Plugin {
  const virtualClientId = "virtual:motionforge-studio-client";
  const resolvedVirtualClientId = `\0${virtualClientId}`;

  return {
    name: "motionforge-studio",
    resolveId(id) {
      if (id === virtualClientId) {
        return resolvedVirtualClientId;
      }

      return null;
    },
    load(id) {
      if (id === resolvedVirtualClientId) {
        return studioClientSource();
      }

      return null;
    },
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        try {
          if (!request.url) {
            next();
            return;
          }

          const url = new URL(request.url, "http://motionforge.local");

          if (url.pathname === "/") {
            const html = await server.transformIndexHtml(
              url.pathname,
              studioHtml(),
            );
            sendHtml(response, html);
            return;
          }

          if (url.pathname === "/__motionforge/scene") {
            await sendSceneJson(response, sceneModulePath);
            return;
          }

          next();
        } catch (error) {
          sendJson(response, 500, {
            ok: false,
            errors: [error instanceof Error ? error.message : String(error)],
          });
        }
      });
    },
  };
}

async function sendSceneJson(
  response: ServerResponse,
  sceneModulePath: string,
) {
  const sceneInput = await loadSceneModule(sceneModulePath);
  const result = validateScene(sceneInput);

  if (!result.ok) {
    sendJson(response, 422, { ok: false, errors: result.errors });
    return;
  }

  sendJson(response, 200, { ok: true, scene: result.scene });
}

function sendHtml(response: ServerResponse, html: string) {
  response.statusCode = 200;
  response.setHeader("content-type", "text/html; charset=utf-8");
  response.end(html);
}

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown,
) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function studioHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MotionForge Studio</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: #e5e7eb;
        color: #111827;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        display: grid;
        min-height: 100vh;
        grid-template-columns: minmax(260px, 420px) minmax(320px, 1fr);
        gap: 24px;
        align-items: center;
        padding: 24px;
      }
      .preview {
        justify-self: end;
        max-height: calc(100vh - 48px);
        overflow: hidden;
        border-radius: 10px;
        background: #111827;
        box-shadow: 0 24px 72px rgb(15 23 42 / 24%);
      }
      canvas {
        display: block;
        max-height: calc(100vh - 48px);
        max-width: 100%;
      }
      .panel {
        max-width: 640px;
      }
      h1 { margin: 0 0 8px; font-size: 40px; line-height: 1; }
      p { color: #4b5563; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin: 18px 0; }
      button {
        height: 38px;
        border: 0;
        border-radius: 8px;
        background: #111827;
        color: white;
        cursor: pointer;
        font: inherit;
        font-weight: 700;
        padding: 0 14px;
      }
      button.secondary { background: #ffffff; color: #111827; border: 1px solid #cbd5e1; }
      button:disabled { cursor: not-allowed; opacity: 0.45; }
      input[type="range"] { width: min(100%, 420px); }
      pre {
        max-height: 280px;
        overflow: auto;
        border-radius: 8px;
        background: #0f172a;
        color: #dbeafe;
        padding: 12px;
        font-size: 12px;
        line-height: 1.5;
      }
      .error { color: #b91c1c; }
      @media (max-width: 840px) {
        main { grid-template-columns: 1fr; }
        .preview { justify-self: center; max-height: 62vh; }
        canvas { max-height: 62vh; }
      }
    </style>
  </head>
  <body>
    <main>
      <section class="preview">
        <canvas id="preview" width="1080" height="1920"></canvas>
      </section>
      <section class="panel">
        <h1>MotionForge Studio</h1>
        <p id="status">Loading scene...</p>
        <label>
          Frame
          <input id="frame" type="range" min="0" max="0" value="0" />
          <output id="frame-readout">0</output>
        </label>
        <div class="actions">
          <button id="play" type="button">Play</button>
          <button id="reload" type="button" class="secondary">Reload scene</button>
          <button id="export" type="button" class="secondary">Export MP4</button>
        </div>
        <pre id="json"></pre>
      </section>
    </main>
    <script type="module" src="/@id/__x00__virtual:motionforge-studio-client"></script>
  </body>
</html>
`;
}

function studioClientSource() {
  return `import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer } from "@motionforge/player";

const canvas = document.querySelector("#preview");
const status = document.querySelector("#status");
const slider = document.querySelector("#frame");
const readout = document.querySelector("#frame-readout");
const playButton = document.querySelector("#play");
const reloadButton = document.querySelector("#reload");
const exportButton = document.querySelector("#export");
const json = document.querySelector("#json");

if (!(canvas instanceof HTMLCanvasElement) || !status || !(slider instanceof HTMLInputElement) || !(readout instanceof HTMLOutputElement) || !(playButton instanceof HTMLButtonElement) || !(reloadButton instanceof HTMLButtonElement) || !(exportButton instanceof HTMLButtonElement) || !json) {
  throw new Error("Studio DOM is missing required elements.");
}

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas2D is unavailable.");
}

const capability = detectExportCapability();
let scene = null;
let player = null;

async function loadScene() {
  status.classList.remove("error");
  status.textContent = "Loading scene...";
  player?.dispose();
  player = null;
  playButton.textContent = "Play";

  const response = await fetch("/__motionforge/scene", { cache: "no-store" });
  const payload = await response.json();

  if (!payload.ok) {
    status.classList.add("error");
    status.textContent = "Scene failed validation.";
    json.textContent = payload.errors.join("\\n");
    return;
  }

  scene = payload.scene;
  canvas.width = scene.width;
  canvas.height = scene.height;
  slider.max = String(scene.duration - 1);
  slider.value = "0";
  readout.value = "0";
  player = await createPlayer({ context, scene, loop: true });
  await player.seek(0);
  player.on("frame", (frame) => {
    slider.value = String(frame);
    readout.value = String(frame);
  });
  json.textContent = JSON.stringify(scene, null, 2);
  status.textContent = \`\${scene.width}x\${scene.height} · \${scene.fps}fps · \${(scene.duration / scene.fps).toFixed(1)}s\`;
  exportButton.disabled = !capability.videoEncoder;
  exportButton.title = capability.videoEncoder
    ? "Export MP4"
    : "MP4 export needs WebCodecs VideoEncoder. Try desktop Chrome or Edge.";
}

slider.addEventListener("input", () => {
  if (!player) return;
  player.pause();
  playButton.textContent = "Play";
  void player.seek(Number(slider.value));
});

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

reloadButton.addEventListener("click", () => {
  void loadScene();
});

exportButton.addEventListener("click", async () => {
  if (!scene || exportButton.disabled) return;

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
    link.download = "motionforge-studio.mp4";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    status.textContent = "Export complete.";
  } catch (error) {
    status.classList.add("error");
    status.textContent = error instanceof Error ? error.message : String(error);
  } finally {
    exportButton.disabled = !capability.videoEncoder;
  }
});

void loadScene();
`;
}
