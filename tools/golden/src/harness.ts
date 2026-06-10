import { renderStill } from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";

export type RenderedFrame = {
  width: number;
  height: number;
  rgba: number[];
};

declare global {
  interface Window {
    renderGoldenFrame: (scene: Scene, frame: number) => RenderedFrame;
  }
}

window.renderGoldenFrame = (scene: Scene, frame: number): RenderedFrame => {
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas2D is unavailable in the golden harness.");
  }

  renderStill(context, scene, frame);

  const image = context.getImageData(0, 0, scene.width, scene.height);

  return {
    width: scene.width,
    height: scene.height,
    rgba: Array.from(image.data),
  };
};
