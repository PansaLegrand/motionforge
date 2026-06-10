import { sampleScene } from "@motionforge/core";
import { detectExportCapability, exportVideo } from "@motionforge/export";
import { renderStill } from "@motionforge/renderer-canvas2d";
import "./styles.css";

const scene = sampleScene();

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Playground DOM is missing ${selector}.`);
  }

  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#preview");
const slider = requiredElement<HTMLInputElement>("#frame");
const readout = requiredElement<HTMLOutputElement>("#frame-readout");
const playButton = requiredElement<HTMLButtonElement>("#play");
const exportButton = requiredElement<HTMLButtonElement>("#export");
const exportStatus = requiredElement<HTMLOutputElement>("#export-status");
const capability = requiredElement<HTMLPreElement>("#capability");

canvas.width = scene.width;
canvas.height = scene.height;

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas2D is unavailable.");
}

const renderContext = context;

let frame = 0;
let playing = false;
let lastTick = 0;

slider.max = String(scene.duration - 1);
capability.textContent = JSON.stringify(detectExportCapability(), null, 2);

function draw(nextFrame: number): void {
  frame = Math.max(0, Math.min(scene.duration - 1, nextFrame));
  slider.value = String(frame);
  readout.value = String(frame);
  renderStill(renderContext, scene, frame);
}

function tick(now: number): void {
  if (!playing) {
    return;
  }

  if (now - lastTick >= 1000 / scene.fps) {
    draw((frame + 1) % scene.duration);
    lastTick = now;
  }

  requestAnimationFrame(tick);
}

slider.addEventListener("input", () => {
  playing = false;
  playButton.textContent = "Play";
  draw(Number(slider.value));
});

playButton.addEventListener("click", () => {
  playing = !playing;
  playButton.textContent = playing ? "Pause" : "Play";
  lastTick = performance.now();

  if (playing) {
    requestAnimationFrame(tick);
  }
});

if (!detectExportCapability().videoEncoder) {
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
      scene,
      onProgress: ({ frameIndex, totalFrames: total }) => {
        exportStatus.value = `Encoding frame ${frameIndex + 1}/${total}`;
      },
    });

    downloadBlob(blob, "motionforge.mp4");
    exportStatus.value = `Done: ${(blob.size / 1024).toFixed(0)} KiB, ${codec}, ${totalFrames} frames`;
  } catch (error) {
    exportStatus.value = error instanceof Error ? error.message : String(error);
  } finally {
    exportButton.disabled = false;
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

draw(0);
