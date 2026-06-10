import { describe, expect, it } from "vitest";
import {
  composition,
  div,
  evaluateKeyframes,
  evaluateScene,
  layoutScene,
  sampleScene,
  text,
} from "./index.js";

describe("builder", () => {
  it("builds schema-valid scenes", () => {
    const scene = composition({
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 90,
    })
      .children(
        div({ id: "root", style: { width: "100%", height: "100%" } }).children(
          text("Hello"),
        ),
      )
      .toJSON();

    expect(scene.nodes[0]?.id).toBe("root");
    expect(scene.nodes[0]?.children?.[0]?.text).toBe("Hello");
  });

  it("assigns auto ids deterministically per scene", () => {
    const build = () =>
      composition({ width: 100, height: 100, fps: 30, duration: 10 })
        .children(div().children(text("a"), text("b")))
        .toJSON();

    const first = build();
    const second = build();

    expect(first).toEqual(second);
    expect(first.nodes[0]?.id).toBe("div-0");
    expect(first.nodes[0]?.children?.map((child) => child.id)).toEqual([
      "text-1",
      "text-2",
    ]);
  });

  it("reflects builder mutations made after attaching to a parent", () => {
    const label = text("late", { id: "label" });
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 10,
    })
      .children(div({ id: "root" }).children(label))
      .toJSON();

    label.animate("opacity", [{ frame: 0, value: 0 }]);

    const updated = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 10,
    })
      .children(div({ id: "root" }).children(label))
      .toJSON();

    expect(scene.nodes[0]?.children?.[0]?.animations).toEqual([]);
    expect(updated.nodes[0]?.children?.[0]?.animations).toHaveLength(1);
  });
});

describe("animation evaluator", () => {
  it("interpolates numeric keyframes", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: 0 },
          { frame: 10, value: 100 },
        ],
        5,
      ),
    ).toBe(50);
  });

  it("filters inactive nodes by frame", () => {
    const scene = sampleScene();
    const resolved = evaluateScene(scene, 130);

    expect(resolved.frame).toBe(119);
    expect(resolved.nodes.length).toBeGreaterThan(0);
  });
});

describe("layout", () => {
  it("resolves absolute left/right insets into an inner width", () => {
    const resolved = evaluateScene(sampleScene(), 25);
    const layout = layoutScene(resolved);
    const subtitleWrap = layout.boxes.find((box) => box.id === "subtitle-wrap");
    const subtitle = subtitleWrap?.children.find(
      (box) => box.id === "subtitle",
    );

    expect(subtitleWrap?.x).toBe(64);
    expect(subtitleWrap?.width).toBe(952);
    expect(subtitle?.x).toBeGreaterThanOrEqual(96);
    expect((subtitle?.x ?? 0) + (subtitle?.width ?? 0)).toBeLessThanOrEqual(
      984,
    );
  });
});
