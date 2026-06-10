import { describe, expect, it } from "vitest";
import { parseScene, validateScene } from "./index.js";

describe("scene schema", () => {
  it("parses a minimal scene", () => {
    const scene = parseScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [],
    });

    expect(scene.assets).toEqual({});
    expect(scene.nodes).toEqual([]);
  });

  it("rejects unsupported style properties", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "bad",
          type: "div",
          style: {
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          },
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join("\n")).toContain("Unsupported style property");
  });
});
