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

export function detectExportCapability(globalObject: Partial<typeof globalThis> = globalThis): ExportCapability {
  return {
    webCodecs: "VideoFrame" in globalObject,
    videoEncoder: "VideoEncoder" in globalObject,
    offscreenCanvas: "OffscreenCanvas" in globalObject,
  };
}

export async function exportVideo(_options: ExportVideoOptions): Promise<Blob> {
  throw new Error(
    "Browser video export is planned for M0 after the reference render loop is stable. Use detectExportCapability() to gate UI for now.",
  );
}
