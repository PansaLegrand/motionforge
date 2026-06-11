import { exportVideo } from "@motionforge/export";
import { renderStill, resolveAssets } from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";

export type RenderedFrame = {
  width: number;
  height: number;
  rgba: number[];
};

export type ExportedVideo = {
  size: number;
  mimeType: string;
  codec: string;
  totalFrames: number;
  /** First 12 bytes of the file; bytes 4-8 spell "ftyp" for valid MP4. */
  header: number[];
};

declare global {
  interface Window {
    renderGoldenFrame: (scene: Scene, frame: number) => Promise<RenderedFrame>;
    renderGoldenExport: (scene: Scene) => Promise<ExportedVideo>;
  }
}

window.renderGoldenFrame = async (
  scene: Scene,
  frame: number,
): Promise<RenderedFrame> => {
  const canvas = document.createElement("canvas");
  canvas.width = scene.width;
  canvas.height = scene.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    throw new Error("Canvas2D is unavailable in the golden harness.");
  }

  const assets = await resolveAssets(scene);
  renderStill(context, scene, frame, { assets });

  const image = context.getImageData(0, 0, scene.width, scene.height);

  return {
    width: scene.width,
    height: scene.height,
    rgba: Array.from(image.data),
  };
};

window.renderGoldenExport = async (scene: Scene): Promise<ExportedVideo> => {
  const { blob, codec, totalFrames } = await exportVideo({ scene });
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return {
    size: bytes.length,
    mimeType: blob.type,
    codec,
    totalFrames,
    header: Array.from(bytes.slice(0, 12)),
  };
};
