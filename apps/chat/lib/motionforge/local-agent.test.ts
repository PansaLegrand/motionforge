import { describe, expect, it } from "vitest";
import { validateScene, type Scene, type SceneAnimation } from "@motionforge/schema";
import {
  applyInstructionLocally,
  createSceneFromInstruction,
} from "./local-agent";

function nodeById(scene: Scene, id: string) {
  return scene.nodes.find((node) => node.id === id);
}

function animationStart(
  animations: SceneAnimation[] | undefined,
  property: string,
): number {
  const frames =
    animations?.find((animation) => animation.property === property)?.frames ??
    [];
  const [first, second] = frames;

  if (first && second && first.frame === 0 && first.value === second.value) {
    return second.frame;
  }

  return first?.frame ?? -1;
}

describe("local motionforge agent", () => {
  it("creates schema-valid first draft scenes", () => {
    const scene = createSceneFromInstruction(
      "Make a vertical product launch teaser for a new AI video app.",
    );

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1920);
    expect(nodeById(scene, "title")?.text).toContain("Vertical product");
  });

  it("uses preset timeline choreography for the first draft", () => {
    const scene = createSceneFromInstruction(
      "Create a kinetic typography scene saying SHIP THE DEMO.",
    );
    const panel = nodeById(scene, "accent-panel");
    const eyebrow = nodeById(scene, "eyebrow");
    const title = nodeById(scene, "title");
    const subtitle = nodeById(scene, "subtitle");
    const caption = nodeById(scene, "caption");

    expect(animationStart(panel?.animations, "transform")).toBe(0);
    expect(animationStart(eyebrow?.animations, "opacity")).toBe(6);
    expect(animationStart(title?.animations, "transform")).toBe(12);
    expect(animationStart(subtitle?.animations, "transform")).toBe(30);
    expect(animationStart(caption?.animations, "transform")).toBe(40);
    expect(title?.animations?.some((animation) =>
      animation.frames.some((frame) => frame.easing?.startsWith("spring(")),
    )).toBe(true);
  });

  it("applies follow-up instructions as patches", () => {
    const scene = createSceneFromInstruction("Make a calm founder update.");
    const result = applyInstructionLocally(scene, "Make the title bigger.");

    expect(result.mode).toBe("patch");
    expect(result.patch).toEqual([
      {
        op: "setStyle",
        id: "title",
        style: { fontSize: 105 },
      },
    ]);
    expect(nodeById(result.scene, "title")?.style?.fontSize).toBe(105);
  });
});
