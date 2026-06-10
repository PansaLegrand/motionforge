import { describe, expect, it } from "vitest";
import type { Scene } from "@motionforge/schema";
import {
  detectExportCapability,
  exportVideo,
  frameToTimestampUs,
  renderFrameSequence,
} from "./index.js";

const scene: Scene = {
  schemaVersion: 0,
  width: 320,
  height: 180,
  fps: 30,
  duration: 10,
  assets: {},
  nodes: [],
};

const context = {} as CanvasRenderingContext2D;

describe("detectExportCapability", () => {
  it("reports missing APIs in plain Node", () => {
    expect(detectExportCapability({})).toEqual({
      webCodecs: false,
      videoEncoder: false,
      offscreenCanvas: false,
    });
  });
});

describe("frameToTimestampUs", () => {
  it("converts frame numbers to microsecond timestamps", () => {
    expect(frameToTimestampUs(0, 30)).toBe(0);
    expect(frameToTimestampUs(15, 30)).toBe(500_000);
    expect(frameToTimestampUs(29, 30)).toBe(966_667);
  });

  it("rejects invalid frame and fps values", () => {
    expect(() => frameToTimestampUs(-1, 30)).toThrow("non-negative integer");
    expect(() => frameToTimestampUs(1.5, 30)).toThrow("non-negative integer");
    expect(() => frameToTimestampUs(1, 0)).toThrow("positive integer");
  });
});

describe("renderFrameSequence", () => {
  it("renders the requested inclusive frame range in order", async () => {
    const rendered: number[] = [];
    const progress: Array<{
      frame: number;
      frameIndex: number;
      totalFrames: number;
      timestampUs: number;
      sceneTimestampUs: number;
    }> = [];

    const result = await renderFrameSequence({
      scene,
      context,
      startFrame: 2,
      endFrame: 4,
      renderFrame: (_context, _scene, frame) => {
        rendered.push(frame);
      },
      onProgress: (event) => {
        progress.push(event);
      },
    });

    expect(rendered).toEqual([2, 3, 4]);
    expect(progress).toEqual([
      {
        frame: 2,
        frameIndex: 0,
        totalFrames: 3,
        timestampUs: 0,
        sceneTimestampUs: 66_667,
      },
      {
        frame: 3,
        frameIndex: 1,
        totalFrames: 3,
        timestampUs: 33_333,
        sceneTimestampUs: 100_000,
      },
      {
        frame: 4,
        frameIndex: 2,
        totalFrames: 3,
        timestampUs: 66_667,
        sceneTimestampUs: 133_333,
      },
    ]);
    expect(result).toEqual({
      startFrame: 2,
      endFrame: 4,
      totalFrames: 3,
      renderedFrames: 3,
    });
  });

  it("awaits onFrame before reporting progress", async () => {
    const events: string[] = [];

    await renderFrameSequence({
      scene,
      context,
      startFrame: 0,
      endFrame: 1,
      renderFrame: (_context, _scene, frame) => {
        events.push(`render:${frame}`);
      },
      onFrame: async ({ frame }) => {
        events.push(`frame:${frame}`);
      },
      onProgress: ({ frame }) => {
        events.push(`progress:${frame}`);
      },
    });

    expect(events).toEqual([
      "render:0",
      "frame:0",
      "progress:0",
      "render:1",
      "frame:1",
      "progress:1",
    ]);
  });

  it("rejects invalid frame ranges", async () => {
    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: -1,
        endFrame: 1,
        renderFrame: () => undefined,
      }),
    ).rejects.toThrow("startFrame must be >= 0");

    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: 5,
        endFrame: 4,
        renderFrame: () => undefined,
      }),
    ).rejects.toThrow("endFrame must be >= startFrame");

    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: 0,
        endFrame: 10,
        renderFrame: () => undefined,
      }),
    ).rejects.toThrow("endFrame must be less than scene.duration");
  });

  it("stops before rendering when aborted", async () => {
    const controller = new AbortController();
    controller.abort(new Error("stop"));

    const rendered: number[] = [];

    await expect(
      renderFrameSequence({
        scene,
        context,
        signal: controller.signal,
        renderFrame: (_context, _scene, frame) => {
          rendered.push(frame);
        },
      }),
    ).rejects.toThrow("stop");

    expect(rendered).toEqual([]);
  });

  it("stops between frames when aborted by progress callback", async () => {
    const controller = new AbortController();
    const rendered: number[] = [];

    await expect(
      renderFrameSequence({
        scene,
        context,
        startFrame: 0,
        endFrame: 4,
        signal: controller.signal,
        renderFrame: (_context, _scene, frame) => {
          rendered.push(frame);
        },
        onProgress: ({ frame }) => {
          if (frame === 1) {
            controller.abort(new Error("stop after frame 1"));
          }
        },
      }),
    ).rejects.toThrow("stop after frame 1");

    expect(rendered).toEqual([0, 1]);
  });
});

describe("exportVideo", () => {
  it("fails fast with an actionable error when WebCodecs is unavailable", async () => {
    // Plain Node has no VideoEncoder; the happy path is covered by the
    // browser-based export smoke test in tools/golden.
    await expect(exportVideo({ scene })).rejects.toThrow(
      /VideoEncoder.*detectExportCapability/,
    );
  });
});
