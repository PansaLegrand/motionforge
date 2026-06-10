import { renderStill } from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";

export type ExportCapability = {
  webCodecs: boolean;
  videoEncoder: boolean;
  offscreenCanvas: boolean;
};

export type ExportVideoOptions = {
  scene: Scene;
  signal?: AbortSignal;
  onProgress?: (progress: { frame: number; totalFrames: number }) => void;
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

export async function exportVideo(_options: ExportVideoOptions): Promise<Blob> {
  throw new Error(
    "Browser video export is planned for M0 after the reference render loop is stable. Use detectExportCapability() to gate UI for now.",
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

function validateFrameRange(scene: Scene, startFrame: number, endFrame: number): void {
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
    throw signal.reason instanceof Error ? signal.reason : new Error("Frame sequence render aborted.");
  }
}
