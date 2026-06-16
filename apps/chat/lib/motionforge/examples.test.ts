import { describe, expect, it } from "vitest";
import { validateScene } from "@motionforge/schema";
import {
  cloneStarterTemplateScene,
  promptChips,
  starterTemplateExamples,
} from "./examples";

function animationStart(sceneId: string, property: string): number {
  const template = starterTemplateExamples.find(
    (example) => example.id === sceneId,
  );
  const title = template?.scene.nodes.find((node) => node.id === "title");
  const frames =
    title?.animations?.find((animation) => animation.property === property)
      ?.frames ?? [];
  const [first, second] = frames;

  if (first && second && first.frame === 0 && first.value === second.value) {
    return second.frame;
  }

  return first?.frame ?? -1;
}

describe("starter template examples", () => {
  it("defines unique preset-backed templates", () => {
    expect(starterTemplateExamples.map((example) => example.id)).toEqual([
      "vertical-product-launch",
      "kinetic-typography",
      "founder-update",
    ]);
    expect(
      new Set(starterTemplateExamples.map((example) => example.id)).size,
    ).toBe(starterTemplateExamples.length);
  });

  it("keeps every starter template schema-valid", () => {
    for (const example of starterTemplateExamples) {
      expect(validateScene(example.scene)).toMatchObject({ ok: true });
      expect(example.prompt.length).toBeGreaterThan(20);
      expect(example.description.length).toBeGreaterThan(20);
      expect(example.scene.nodes.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("uses the first-draft timeline choreography", () => {
    expect(animationStart("vertical-product-launch", "transform")).toBe(12);
    expect(animationStart("kinetic-typography", "transform")).toBe(12);
    expect(animationStart("founder-update", "transform")).toBe(12);
  });

  it("clones starter template scenes before editor mutation", () => {
    const [example] = starterTemplateExamples;

    expect(example).toBeDefined();

    const clone = cloneStarterTemplateScene(example!);

    expect(clone).toEqual(example!.scene);
    expect(clone).not.toBe(example!.scene);
    expect(clone.nodes[0]).not.toBe(example!.scene.nodes[0]);
  });

  it("keeps prompt chips available for chat-input examples", () => {
    expect(promptChips.length).toBeGreaterThan(starterTemplateExamples.length);
    expect(promptChips).toContain(starterTemplateExamples[0]!.prompt);
    expect(promptChips).toContain(
      "Show a subtitle template gallery previewing all caption styles.",
    );
  });
});
