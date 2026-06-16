import { describe, expect, it } from "vitest";
import { describeMediaPlanStep, formatMediaClock } from "./plan";

describe("media operation plan helpers", () => {
  it("formats media clocks without unnecessary decimals", () => {
    expect(formatMediaClock(0)).toBe("00:00");
    expect(formatMediaClock(5)).toBe("00:05");
    expect(formatMediaClock(65.25)).toBe("01:05.25");
  });

  it("describes clip and text steps for compact chat UI", () => {
    expect(
      describeMediaPlanStep(
        {
          type: "sequence-clip",
          nodeId: "video-1-node",
          assetId: "video-1",
          label: "Video 1",
          mediaType: "video",
          sourceStartSeconds: 5,
          sourceEndSeconds: 10,
          sceneStartFrame: 0,
          durationFrames: 150,
        },
        30,
      ),
    ).toEqual({
      title: "Video 1 - 00:05-00:10",
      detail: "Starts 00:00 - 150 frames",
    });

    expect(
      describeMediaPlanStep(
        {
          type: "text-overlay",
          nodeId: "video-2-text",
          text: "I love this",
          targetAssetId: "video-2",
          fromFrame: 150,
          durationFrames: 360,
          position: "top",
        },
        30,
      ),
    ).toEqual({
      title: 'Text - "I love this"',
      detail: "top - starts 00:05 - 360 frames",
    });
  });
});
