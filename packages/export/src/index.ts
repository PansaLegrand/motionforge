import { renderStill } from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";
import {
  BufferTarget,
  CanvasSource,
  getFirstEncodableVideoCodec,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  type Quality,
  type VideoCodec,
} from "mediabunny";

export type ExportCapability = {
  webCodecs: boolean;
  videoEncoder: boolean;
  offscreenCanvas: boolean;
};

export type ExportVideoOptions = {
  scene: Scene;
  signal?: AbortSignal;
  onProgress?: (progress: RenderFrameSequenceProgress) => void;
  /** First scene frame to export (default 0). */
  startFrame?: number;
  /** Last scene frame to export, inclusive (default scene.duration - 1). */
  endFrame?: number;
  /**
   * Target bitrate in bits per second, or a mediabunny Quality preset.
   * Defaults to QUALITY_HIGH.
   */
  bitrate?: number | Quality;
  /**
   * Candidate codecs in order of preference. Defaults to every codec the MP4
   * container supports; the first one this browser can encode is used.
   */
  codecs?: VideoCodec[];
};

export type ExportVideoResult = {
  blob: Blob;
  codec: VideoCodec;
  totalFrames: number;
};

export type RenderFrameSequenceProgress = {
  frame: number;
  frameIndex: number;
  totalFrames: number;
  timestampUs: number;
  sceneTimestampUs: number;
};

export type RenderedSequenceFrame = {
  frame: number;
  frameIndex: number;
  timestampUs: number;
  sceneTimestampUs: number;
};

export type RenderFrameSequenceOptions = {
  scene: Scene;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  startFrame?: number;
  endFrame?: number;
  signal?: AbortSignal;
  renderFrame?: (
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    scene: Scene,
    frame: number,
  ) => void;
  onFrame?: (frame: RenderedSequenceFrame) => void | Promise<void>;
  onProgress?: (progress: RenderFrameSequenceProgress) => void;
};

export type RenderFrameSequenceResult = {
  startFrame: number;
  endFrame: number;
  totalFrames: number;
  renderedFrames: number;
};

export function detectExportCapability(
  globalObject: Partial<typeof globalThis> = globalThis,
): ExportCapability {
  return {
    webCodecs: "VideoFrame" in globalObject,
    videoEncoder: "VideoEncoder" in globalObject,
    offscreenCanvas: "OffscreenCanvas" in globalObject,
  };
}

export async function renderFrameSequence(
  options: RenderFrameSequenceOptions,
): Promise<RenderFrameSequenceResult> {
  const startFrame = options.startFrame ?? 0;
  const endFrame = options.endFrame ?? options.scene.duration - 1;

  validateFrameRange(options.scene, startFrame, endFrame);
  throwIfAborted(options.signal);

  const totalFrames = endFrame - startFrame + 1;
  const renderFrame = options.renderFrame ?? renderStill;
  let renderedFrames = 0;

  for (let frame = startFrame; frame <= endFrame; frame += 1) {
    throwIfAborted(options.signal);

    renderFrame(options.context, options.scene, frame);

    const rendered: RenderedSequenceFrame = {
      frame,
      frameIndex: frame - startFrame,
      timestampUs: frameToTimestampUs(frame - startFrame, options.scene.fps),
      sceneTimestampUs: frameToTimestampUs(frame, options.scene.fps),
    };

    await options.onFrame?.(rendered);

    renderedFrames += 1;
    options.onProgress?.({
      ...rendered,
      totalFrames,
    });
  }

  return {
    startFrame,
    endFrame,
    totalFrames,
    renderedFrames,
  };
}

/**
 * Renders the scene frame by frame through the shared Canvas2D renderer and
 * encodes it to an MP4 in the browser via WebCodecs (encoding and muxing by
 * mediabunny). Resolves with the finished file as a Blob.
 */
export async function exportVideo(
  options: ExportVideoOptions,
): Promise<ExportVideoResult> {
  const { scene } = options;
  const capability = detectExportCapability();

  if (!capability.videoEncoder) {
    throw new Error(
      "exportVideo() needs WebCodecs (VideoEncoder) which this environment does not provide. Gate export UI with detectExportCapability().",
    );
  }

  const format = new Mp4OutputFormat();
  const codec = await getFirstEncodableVideoCodec(
    options.codecs ?? format.getSupportedVideoCodecs(),
    { width: scene.width, height: scene.height },
  );

  if (!codec) {
    throw new Error(
      `This browser cannot encode any MP4-compatible video codec at ${scene.width}x${scene.height}. Try a smaller scene size or a browser with WebCodecs encoding support.`,
    );
  }

  const { canvas, context } = createExportCanvas(scene.width, scene.height);
  const output = new Output({ format, target: new BufferTarget() });
  const source = new CanvasSource(canvas, {
    codec,
    bitrate: options.bitrate ?? QUALITY_HIGH,
  });
  output.addVideoTrack(source, { frameRate: scene.fps });
  await output.start();

  const frameDuration = 1 / scene.fps;
  let result: RenderFrameSequenceResult;

  try {
    result = await renderFrameSequence({
      scene,
      context,
      startFrame: options.startFrame,
      endFrame: options.endFrame,
      signal: options.signal,
      // Awaiting add() respects encoder backpressure before the next frame
      // is drawn over the shared canvas.
      onFrame: async ({ timestampUs }) => {
        await source.add(timestampUs / 1_000_000, frameDuration);
      },
      onProgress: options.onProgress,
    });

    await output.finalize();
  } catch (error) {
    try {
      await output.cancel();
    } catch {
      // The render/encode error is the one worth surfacing.
    }

    throw error;
  }

  const buffer = output.target.buffer;

  if (!buffer) {
    throw new Error("MP4 muxing finished without producing an output buffer.");
  }

  return {
    blob: new Blob([buffer], { type: format.mimeType }),
    codec,
    totalFrames: result.totalFrames,
  };
}

function createExportCanvas(
  width: number,
  height: number,
): {
  canvas: HTMLCanvasElement | OffscreenCanvas;
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d");

    if (context) {
      return { canvas, context };
    }
  }

  if (typeof document !== "undefined") {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    if (context) {
      return { canvas, context };
    }
  }

  throw new Error(
    "exportVideo() needs a Canvas2D context via OffscreenCanvas or a DOM canvas element.",
  );
}

export function frameToTimestampUs(frame: number, fps: number): number {
  if (!Number.isInteger(frame) || frame < 0) {
    throw new Error(`Frame must be a non-negative integer, received ${frame}.`);
  }

  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error(`FPS must be a positive integer, received ${fps}.`);
  }

  return Math.round((frame * 1_000_000) / fps);
}

function validateFrameRange(
  scene: Scene,
  startFrame: number,
  endFrame: number,
): void {
  if (!Number.isInteger(startFrame) || !Number.isInteger(endFrame)) {
    throw new Error(
      `Frame range must use integer frames, received startFrame=${startFrame}, endFrame=${endFrame}.`,
    );
  }

  if (startFrame < 0) {
    throw new Error(`startFrame must be >= 0, received ${startFrame}.`);
  }

  if (endFrame < startFrame) {
    throw new Error(
      `endFrame must be >= startFrame, received startFrame=${startFrame}, endFrame=${endFrame}.`,
    );
  }

  if (endFrame >= scene.duration) {
    throw new Error(
      `endFrame must be less than scene.duration (${scene.duration}), received ${endFrame}.`,
    );
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new Error("Frame sequence render aborted.");
  }
}
