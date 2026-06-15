import { describe, expect, it } from "vitest";
import {
  formatFrameTime,
  formatSeconds,
  frameFromTimelinePoint,
} from "./time";

describe("editor time formatting", () => {
  it("formats frame durations as seconds with two decimals", () => {
    expect(formatSeconds(45, 30)).toBe("1.50s");
    expect(formatSeconds(1, 24)).toBe("0.04s");
  });

  it("formats timeline frame positions as mm:ss", () => {
    expect(formatFrameTime(0, 30)).toBe("00:00");
    expect(formatFrameTime(59, 30)).toBe("00:01");
    expect(formatFrameTime(1_830, 30)).toBe("01:01");
  });

  it("clamps invalid fps and negative frames safely", () => {
    expect(formatFrameTime(90, 0)).toBe("01:30");
    expect(formatFrameTime(-10, 30)).toBe("00:00");
  });

  it("maps timeline pointer positions to clamped frame numbers", () => {
    expect(
      frameFromTimelinePoint({
        clientX: 50,
        timelineLeft: 50,
        timelineWidth: 300,
        duration: 150,
      }),
    ).toBe(0);
    expect(
      frameFromTimelinePoint({
        clientX: 200,
        timelineLeft: 50,
        timelineWidth: 300,
        duration: 150,
      }),
    ).toBe(75);
    expect(
      frameFromTimelinePoint({
        clientX: 400,
        timelineLeft: 50,
        timelineWidth: 300,
        duration: 150,
      }),
    ).toBe(149);
  });

  it("handles invalid timeline geometry safely", () => {
    expect(
      frameFromTimelinePoint({
        clientX: 10,
        timelineLeft: 0,
        timelineWidth: 0,
        duration: 150,
      }),
    ).toBe(0);
    expect(
      frameFromTimelinePoint({
        clientX: 10,
        timelineLeft: 0,
        timelineWidth: 100,
        duration: 0,
      }),
    ).toBe(0);
  });
});
