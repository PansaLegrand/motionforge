import { describe, expect, it } from "vitest";
import { detectExportCapability } from "./index.js";

describe("detectExportCapability", () => {
  it("reports missing APIs in plain Node", () => {
    expect(detectExportCapability({})).toEqual({
      webCodecs: false,
      videoEncoder: false,
      offscreenCanvas: false,
    });
  });
});
