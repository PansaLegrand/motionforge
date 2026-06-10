import { describe, expect, it } from "vitest";
import { sampleScene } from "@motionforge/core";
import { renderStill } from "./index.js";

describe("renderStill", () => {
  it("exports a callable browser renderer", () => {
    expect(typeof renderStill).toBe("function");
    expect(sampleScene().width).toBe(1080);
  });
});
