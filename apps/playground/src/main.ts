import { sampleScene } from "@motionforge/core";
import { detectExportCapability } from "@motionforge/export";
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

draw(0);
