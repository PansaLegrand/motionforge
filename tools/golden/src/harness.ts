import { exportVideo } from "@motionforge/export";
import {
  disposeAssets,
  prepareFrame,
  renderStill,
  resolveAssets,
} from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";
import { ALL_FORMATS, BlobSource, CanvasSink, Input } from "mediabunny";

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

export type VideoCheck = {
  label: string;
  pass: boolean;
  detail: string;
};

declare global {
  interface Window {
    renderGoldenFrame: (scene: Scene, frame: number) => Promise<RenderedFrame>;
    renderGoldenExport: (scene: Scene) => Promise<ExportedVideo>;
    runGoldenVideoChecks: () => Promise<VideoCheck[]>;
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
  await prepareFrame(scene, frame, assets);
  renderStill(context, scene, frame, { assets });

  const image = context.getImageData(0, 0, scene.width, scene.height);

  return {
    width: scene.width,
    height: scene.height,
    rgba: Array.from(image.data),
  };
};

/**
 * End-to-end video-clip check, fully in-browser:
 * 1. Synthesize a source clip with exportVideo (red for 1s, blue for 1s).
 * 2. Composite it through video nodes with trim/playbackRate and verify the
 *    previewed pixels show the right source frames.
 * 3. Export the composite scene to MP4, decode it back, and verify the
 *    exported pixels match the preview.
 * Colors are checked with tolerance because both encodes are lossy.
 */
window.runGoldenVideoChecks = async (): Promise<VideoCheck[]> => {
  const checks: VideoCheck[] = [];
  const fps = 30;

  const sourceScene: Scene = {
    schemaVersion: 0,
    width: 320,
    height: 180,
    fps,
    duration: 60,
    assets: {},
    nodes: [
      {
        id: "red",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#ff0000" },
        children: [],
      },
      {
        id: "blue",
        type: "div",
        from: 30,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#0000ff" },
        children: [],
      },
    ],
  };

  const clipStart = performance.now();
  const { blob: clipBlob } = await exportVideo({ scene: sourceScene });
  const clipMs = performance.now() - clipStart;
  const clipUrl = URL.createObjectURL(clipBlob);

  const compositeScene: Scene = {
    schemaVersion: 0,
    width: 320,
    height: 180,
    fps,
    duration: 30,
    assets: {
      clip: { id: "clip", type: "video", src: clipUrl },
    },
    nodes: [
      {
        id: "background",
        type: "div",
        from: 0,
        duration: 30,
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
        children: [],
      },
      {
        id: "trimmed",
        type: "video",
        assetId: "clip",
        videoStartTime: 1.5,
        from: 0,
        duration: 30,
        style: {
          position: "absolute",
          left: 10,
          top: 40,
          width: 140,
          height: 100,
          objectFit: "fill",
        },
        children: [],
      },
      {
        id: "rated",
        type: "video",
        assetId: "clip",
        videoStartTime: 0.5,
        playbackRate: 2,
        from: 0,
        duration: 30,
        style: {
          position: "absolute",
          left: 170,
          top: 40,
          width: 140,
          height: 100,
          objectFit: "fill",
        },
        children: [],
      },
    ],
  };

  const assets = await resolveAssets(compositeScene);

  const readCenter = (
    pixels: Uint8ClampedArray | number[],
    width: number,
    x: number,
    y: number,
  ): [number, number, number] => {
    const offset = (y * width + x) * 4;
    return [
      Number(pixels[offset]),
      Number(pixels[offset + 1]),
      Number(pixels[offset + 2]),
    ];
  };

  const isRed = ([r, g, b]: [number, number, number]): boolean =>
    r > 180 && g < 80 && b < 80;
  const isBlue = ([r, g, b]: [number, number, number]): boolean =>
    b > 180 && r < 80 && g < 80;

  const renderComposite = async (frame: number): Promise<Uint8ClampedArray> => {
    const canvas = document.createElement("canvas");
    canvas.width = compositeScene.width;
    canvas.height = compositeScene.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      throw new Error("Canvas2D unavailable");
    }

    await prepareFrame(compositeScene, frame, assets);
    renderStill(context, compositeScene, frame, { assets });
    return context.getImageData(0, 0, canvas.width, canvas.height).data;
  };

  // Scene frame 0: trimmed node shows source t=1.5s (blue half);
  // rated node shows 0.5 + 0*2 = 0.5s (red half).
  const frame0 = await renderComposite(0);
  const trimmedAt0 = readCenter(frame0, 320, 80, 90);
  const ratedAt0 = readCenter(frame0, 320, 240, 90);
  checks.push({
    label: "trim: videoStartTime 1.5s shows the blue source half at frame 0",
    pass: isBlue(trimmedAt0),
    detail: `rgb(${trimmedAt0.join(", ")})`,
  });
  checks.push({
    label: "rate: 0.5s + 0x2 shows the red source half at frame 0",
    pass: isRed(ratedAt0),
    detail: `rgb(${ratedAt0.join(", ")})`,
  });

  // Scene frame 15 (0.5s): rated node shows 0.5 + 0.5*2 = 1.5s (blue half).
  const frame15 = await renderComposite(15);
  const ratedAt15 = readCenter(frame15, 320, 240, 90);
  checks.push({
    label: "rate: playbackRate 2 reaches the blue source half by frame 15",
    pass: isBlue(ratedAt15),
    detail: `rgb(${ratedAt15.join(", ")})`,
  });

  // Export the composite and decode frame 0 back from the file.
  const exportStart = performance.now();
  const { blob: compositeBlob } = await exportVideo({
    scene: compositeScene,
    assets,
  });
  const exportMs = performance.now() - exportStart;

  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(compositeBlob),
  });
  const track = await input.getPrimaryVideoTrack();

  if (!track) {
    throw new Error("exported composite has no video track");
  }

  const sink = new CanvasSink(track);
  const wrapped = await sink.getCanvas(0);

  if (!wrapped) {
    throw new Error("exported composite has no frame at t=0");
  }

  const decodeCanvas = document.createElement("canvas");
  decodeCanvas.width = wrapped.canvas.width;
  decodeCanvas.height = wrapped.canvas.height;
  const decodeContext = decodeCanvas.getContext("2d", {
    willReadFrequently: true,
  });

  if (!decodeContext) {
    throw new Error("Canvas2D unavailable for decode");
  }

  decodeContext.drawImage(wrapped.canvas, 0, 0);
  const exported = decodeContext.getImageData(
    0,
    0,
    decodeCanvas.width,
    decodeCanvas.height,
  ).data;
  const exportedTrimmed = readCenter(exported, decodeCanvas.width, 80, 90);
  const exportedRated = readCenter(exported, decodeCanvas.width, 240, 90);

  checks.push({
    label: "export round-trip: exported frame 0 matches preview (trimmed node)",
    pass: isBlue(exportedTrimmed),
    detail: `rgb(${exportedTrimmed.join(", ")})`,
  });
  checks.push({
    label: "export round-trip: exported frame 0 matches preview (rated node)",
    pass: isRed(exportedRated),
    detail: `rgb(${exportedRated.join(", ")})`,
  });
  checks.push({
    label: "timing baseline",
    pass: true,
    detail: `source clip (60f): ${clipMs.toFixed(0)}ms, composite export (30f, 2 video nodes): ${exportMs.toFixed(0)}ms`,
  });

  input.dispose();
  disposeAssets(assets);
  URL.revokeObjectURL(clipUrl);

  return checks;
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
