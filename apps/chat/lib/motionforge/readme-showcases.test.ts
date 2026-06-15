import { describe, expect, it } from "vitest";
import { validateScene } from "@motionforge/schema";
import {
  cloneReadmeShowcaseScene,
  readmeShowcaseExamples,
} from "./readme-showcases";

describe("README showcase examples", () => {
  it("mirror the README verification gallery order", () => {
    expect(readmeShowcaseExamples.map((example) => example.id)).toEqual([
      "edgy-kinetic-typography",
      "edgy-app-promo",
      "edgy-animated-chart",
      "edgy-beat-edit",
      "edgy-cinematic-title",
      "edgy-multicam",
    ]);
  });

  it("load schema-valid scenes with poster frames inside the timeline", () => {
    for (const example of readmeShowcaseExamples) {
      const result = validateScene(example.scene);

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(example.posterFrame).toBeGreaterThanOrEqual(0);
      expect(example.posterFrame).toBeLessThan(example.scene.duration);
      expect(example.jsonPath).toMatch(/^verification\/.+\.json$/);
      expect(example.videoPath).toMatch(/^verification\/.+\.mp4$/);
    }
  });

  it("clones scenes before loading them into editable app state", () => {
    const [example] = readmeShowcaseExamples;

    expect(example).toBeDefined();

    const clone = cloneReadmeShowcaseScene(example!);

    expect(clone).toEqual(example!.scene);
    expect(clone).not.toBe(example!.scene);
    expect(clone.nodes[0]).not.toBe(example!.scene.nodes[0]);
  });
});
