import { describe, expect, it } from "vitest";
import { formatFrameTime, formatSeconds } from "./time";

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
});
