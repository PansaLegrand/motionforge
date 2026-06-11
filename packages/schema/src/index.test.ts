import { describe, expect, it } from "vitest";
import { parseScene, sceneJsonSchema, validateScene } from "./index.js";

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
    expect(result.ok ? [] : result.errors.join("\n")).toContain(
      "Unsupported style property",
    );
  });

  it("accepts textStroke shorthand", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "caption",
          type: "text",
          text: "Hello",
          style: {
            textStroke: "6px #000000",
          },
        },
      ],
    });

    expect(result.ok).toBe(true);
  });

  it("rejects duplicate node ids anywhere in the tree", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 1920,
      height: 1080,
      fps: 30,
      duration: 90,
      nodes: [
        {
          id: "root",
          type: "div",
          children: [{ id: "root", type: "div" }],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join("\n")).toContain(
      'Duplicate node id "root"',
    );
  });

  it("rejects keyframes that are not strictly increasing", () => {
    const result = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "animated",
          type: "div",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 10, value: 0 },
                { frame: 10, value: 1 },
              ],
            },
          ],
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors.join("\n")).toContain(
      "strictly increasing",
    );
  });

  it("accepts trim and rate on video nodes, rejects them elsewhere", () => {
    const valid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      assets: { clip: { id: "clip", type: "video", src: "clip.mp4" } },
      nodes: [
        {
          id: "shot",
          type: "video",
          assetId: "clip",
          videoStartTime: 1.5,
          playbackRate: 2,
        },
      ],
    });

    expect(valid.ok).toBe(true);

    const invalid = validateScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [{ id: "box", type: "div", videoStartTime: 1 }],
    });

    expect(invalid.ok).toBe(false);
    expect(invalid.ok ? [] : invalid.errors.join("\n")).toContain(
      "only applies to video nodes",
    );
  });

  it("accepts easing expressions and rejects malformed ones", () => {
    const sceneWith = (easing: string) => ({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [
        {
          id: "box",
          type: "div",
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 0, value: 0 },
                { frame: 10, value: 1, easing },
              ],
            },
          ],
        },
      ],
    });

    expect(validateScene(sceneWith("cubic-bezier(0.42, 0, 0.58, 1)")).ok).toBe(
      true,
    );
    expect(validateScene(sceneWith("spring")).ok).toBe(true);
    expect(validateScene(sceneWith("spring(0.4)")).ok).toBe(true);
    // x out of range and unknown names must fail with the actionable message.
    expect(validateScene(sceneWith("cubic-bezier(2, 0, 0.5, 1)")).ok).toBe(
      false,
    );
    expect(validateScene(sceneWith("bounce")).ok).toBe(false);
    expect(validateScene(sceneWith("spring(1)")).ok).toBe(false);
  });

  it("re-parsing a parsed scene is an identity no-op", () => {
    const scene = parseScene({
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 30,
      nodes: [],
    });

    expect(parseScene(scene)).toBe(scene);

    const validated = validateScene(scene);
    expect(validated.ok && validated.scene).toBe(scene);
  });

  it("exports a JSON Schema covering the recursive node structure", () => {
    const jsonSchema = sceneJsonSchema() as {
      $ref?: string;
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
    };

    expect(jsonSchema.$ref).toBe("#/definitions/MotionforgeScene");

    const scene = jsonSchema.definitions?.MotionforgeScene;
    expect(scene?.properties).toHaveProperty("schemaVersion");
    expect(scene?.properties).toHaveProperty("nodes");
    expect(JSON.stringify(jsonSchema)).toContain('"opacity"');
  });
});
