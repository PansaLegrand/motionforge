import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import {
  disposeAssets,
  resolveAssets,
  type ResolvedAssets,
} from "@motionforge/renderer-canvas2d";
import { showcaseScenes, type ShowcaseScene } from "@motionforge/showcase";
import "./styles.css";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Playground DOM is missing ${selector}.`);
  }

  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#preview");
const sceneSelect = requiredElement<HTMLSelectElement>("#scene");
const sceneTitle = requiredElement<HTMLHeadingElement>("#scene-title");
const sceneDescription = requiredElement<HTMLParagraphElement>(
  "#scene-description",
);
const sceneProves = requiredElement<HTMLUListElement>("#scene-proves");
const slider = requiredElement<HTMLInputElement>("#frame");
const readout = requiredElement<HTMLOutputElement>("#frame-readout");
const playButton = requiredElement<HTMLButtonElement>("#play");
const exportButton = requiredElement<HTMLButtonElement>("#export");
const exportStatus = requiredElement<HTMLOutputElement>("#export-status");
const capability = requiredElement<HTMLPreElement>("#capability");

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas2D is unavailable.");
}

const renderContext = context;
const capabilityResult = detectExportCapability();

let current = showcaseScenes[0] as ShowcaseScene;
let assets: ResolvedAssets | undefined;
let player: Player | undefined;
let loadVersion = 0;

capability.textContent = JSON.stringify(capabilityResult, null, 2);

for (const entry of showcaseScenes) {
  const option = document.createElement("option");
  option.value = entry.id;
  option.textContent = entry.title;
  sceneSelect.append(option);
}

function showFrame(frame: number): void {
  slider.value = String(frame);
  readout.value = String(frame);
}

slider.addEventListener("input", () => {
  if (!player) {
    return;
  }

  player.pause();
  playButton.textContent = "Play";
  void player.seek(Number(slider.value));
});

playButton.addEventListener("click", () => {
  if (!player) {
    return;
  }

  if (player.playing) {
    player.pause();
    playButton.textContent = "Play";
  } else {
    player.play();
    playButton.textContent = "Pause";
  }
});

sceneSelect.addEventListener("change", () => {
  const next = showcaseScenes.find((entry) => entry.id === sceneSelect.value);

  if (next) {
    void loadScene(next);
  }
});

if (!capabilityResult.videoEncoder) {
  exportButton.disabled = true;
  exportStatus.value = "WebCodecs is unavailable in this browser.";
}

exportButton.addEventListener("click", () => {
  void runExport();
});

async function runExport(): Promise<void> {
  exportButton.disabled = true;

  try {
    const { blob, codec, totalFrames } = await exportVideo({
      scene: current.scene,
      assets,
      onProgress: ({ frameIndex, totalFrames: total }) => {
        exportStatus.value = `Encoding frame ${frameIndex + 1}/${total}`;
      },
    });

    downloadBlob(blob, `motionforge-${current.id}.mp4`);
    exportStatus.value = `Done: ${(blob.size / 1024).toFixed(0)} KiB, ${codec}, ${totalFrames} frames`;
  } catch (error) {
    exportStatus.value = error instanceof Error ? error.message : String(error);
  } finally {
    exportButton.disabled = !capabilityResult.videoEncoder;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function loadScene(entry: ShowcaseScene): Promise<void> {
  const version = ++loadVersion;
  player?.dispose();
  player = undefined;
  playButton.textContent = "Play";
  current = entry;
  sceneSelect.value = entry.id;
  sceneTitle.textContent = entry.title;
  sceneDescription.textContent = entry.description;
  sceneProves.replaceChildren(
    ...entry.proves.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );

  canvas.width = entry.scene.width;
  canvas.height = entry.scene.height;
  slider.max = String(entry.scene.duration - 1);
  const posterFrame = Math.min(entry.posterFrame, entry.scene.duration - 1);
  showFrame(posterFrame);
  exportButton.disabled = true;
  exportStatus.value = "Loading scene assets...";

  const previousAssets = assets;
  assets = undefined;
  renderContext.clearRect(0, 0, canvas.width, canvas.height);

  try {
    const resolved = await resolveAssets(entry.scene);

    if (version !== loadVersion) {
      disposeAssets(resolved);
      return;
    }

    previousAssets && disposeAssets(previousAssets);
    assets = resolved;

    // The playground owns the assets (export reuses them), so the player
    // gets them pre-resolved and never disposes them itself.
    const created = await createPlayer({
      context: renderContext,
      scene: entry.scene,
      assets,
      loop: true,
    });

    if (version !== loadVersion) {
      created.dispose();
      return;
    }

    player = created;
    player.on("frame", showFrame);
    // Land on the poster frame; the user may also have scrubbed during load.
    await player.seek(Number(slider.value));
    exportButton.disabled = !capabilityResult.videoEncoder;
    exportStatus.value = "";
  } catch (error) {
    if (version === loadVersion) {
      exportStatus.value =
        error instanceof Error ? error.message : String(error);
    }
  }
}

void loadScene(current);
