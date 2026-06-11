import { describe, expect, it } from "vitest";
import {
  composition,
  div,
  evaluateKeyframes,
  evaluateScene,
  layoutScene,
  parseColor,
  sampleScene,
  text,
} from "./index.js";

function layoutOf(builder: ReturnType<typeof composition>) {
  return layoutScene(evaluateScene(builder.toJSON(), 0));
}

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

  it("exposes node-local frames through nested from offsets", () => {
    const scene = composition({
      width: 100,
      height: 100,
      fps: 30,
      duration: 60,
    })
      .children(
        div({ id: "outer", from: 10, duration: 40 }).children(
          div({ id: "inner", from: 5, duration: 20 }),
        ),
      )
      .toJSON();

    // Scene frame 18: outer local = 8, inner local = 8 - 5 = 3.
    const resolved = evaluateScene(scene, 18);
    const outer = resolved.nodes[0];
    const inner = outer?.children[0];

    expect(outer?.localFrame).toBe(8);
    expect(inner?.localFrame).toBe(3);
  });

  it("interpolates hex colors in RGBA space", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "#000000" },
          { frame: 10, value: "#ffffff" },
        ],
        5,
      ),
    ).toBe("rgba(128, 128, 128, 1)");
  });

  it("interpolates alpha between rgba colors", () => {
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "rgba(255, 0, 0, 0)" },
          { frame: 10, value: "rgba(255, 0, 0, 1)" },
        ],
        5,
      ),
    ).toBe("rgba(255, 0, 0, 0.5)");
  });

  it("supports short hex and applies easing to color segments", () => {
    // easeIn at t=0.5 gives 0.25: 255 * 0.25 = 63.75 -> 64.
    expect(
      evaluateKeyframes(
        [
          { frame: 0, value: "#000" },
          { frame: 10, value: "#fff", easing: "easeIn" },
        ],
        5,
      ),
    ).toBe("rgba(64, 64, 64, 1)");
  });

  it("steps non-color strings at the next keyframe", () => {
    const frames = [
      { frame: 0, value: "left" },
      { frame: 10, value: "right" },
    ];

    expect(evaluateKeyframes(frames, 9)).toBe("left");
    expect(evaluateKeyframes(frames, 10)).toBe("right");
  });
});

describe("parseColor", () => {
  it("parses hex and rgb() forms", () => {
    expect(parseColor("#1080ff")).toEqual({ r: 16, g: 128, b: 255, a: 1 });
    expect(parseColor("#108")).toEqual({ r: 17, g: 0, b: 136, a: 1 });
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.25)")).toEqual({
      r: 1,
      g: 2,
      b: 3,
      a: 0.25,
    });
  });

  it("returns null for non-colors so they step instead", () => {
    expect(parseColor("tomato")).toBeNull();
    expect(
      parseColor("linear-gradient(180deg, #000 0%, #fff 100%)"),
    ).toBeNull();
    expect(parseColor("translate(10px)")).toBeNull();
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

  it("applies margin as outer spacing and shrinks auto sizes", () => {
    const layout = layoutOf(
      composition({ width: 200, height: 100, fps: 30, duration: 1 }).children(
        div({ id: "spaced", style: { margin: 10 } }),
      ),
    );
    const spaced = layout.boxes.find((box) => box.id === "spaced");

    expect(spaced?.x).toBe(10);
    expect(spaced?.y).toBe(10);
    expect(spaced?.width).toBe(180);
    expect(spaced?.height).toBe(80);
  });

  it("clamps explicit sizes with min/max, min winning", () => {
    const layout = layoutOf(
      composition({ width: 200, height: 100, fps: 30, duration: 1 }).children(
        div({ id: "maxed", style: { width: 500, maxWidth: "50%" } }),
        div({
          id: "conflicted",
          style: { width: 10, minWidth: 120, maxWidth: 80 },
        }),
      ),
    );

    expect(layout.boxes.find((box) => box.id === "maxed")?.width).toBe(100);
    expect(layout.boxes.find((box) => box.id === "conflicted")?.width).toBe(
      120,
    );
  });

  it("distributes leftover space with justify-content space-between", () => {
    const layout = layoutOf(
      composition({ width: 300, height: 100, fps: 30, duration: 1 }).children(
        div({
          id: "rowbox",
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "space-between",
          },
        }).children(
          div({ id: "a", style: { width: 50, height: 20 } }),
          div({ id: "b", style: { width: 50, height: 20 } }),
          div({ id: "c", style: { width: 50, height: 20 } }),
        ),
      ),
    );
    const row = layout.boxes.find((box) => box.id === "rowbox");
    const xs = row?.children.map((child) => child.x);

    expect(xs).toEqual([0, 125, 250]);
  });

  it("stretches unsized children across the cross axis", () => {
    const layout = layoutOf(
      composition({ width: 300, height: 100, fps: 30, duration: 1 }).children(
        div({
          id: "rowbox",
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "stretch",
          },
        }).children(
          div({ id: "auto", style: { width: 50 } }),
          div({ id: "fixed", style: { width: 50, height: 40 } }),
        ),
      ),
    );
    const row = layout.boxes.find((box) => box.id === "rowbox");

    expect(row?.children.find((child) => child.id === "auto")?.height).toBe(
      100,
    );
    expect(row?.children.find((child) => child.id === "fixed")?.height).toBe(
      40,
    );
  });
});
