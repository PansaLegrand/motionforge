import { describe, expect, it } from "vitest";
import { sampleScene } from "@motionforge/core";
import {
  computeObjectFit,
  parseLinearGradient,
  renderStill,
  wrapTextLines,
} from "./index.js";

// Deterministic fake measurer: every character is 10px wide.
const measure = (line: string): number => line.length * 10;

describe("renderStill", () => {
  it("exports a callable browser renderer", () => {
    expect(typeof renderStill).toBe("function");
    expect(sampleScene().width).toBe(1080);
  });
});

describe("wrapTextLines", () => {
  it("keeps short text on a single line", () => {
    expect(wrapTextLines("hello world", 200, measure)).toEqual(["hello world"]);
  });

  it("always breaks on explicit newlines", () => {
    expect(wrapTextLines("one\ntwo three", 1000, measure)).toEqual([
      "one",
      "two three",
    ]);
  });

  it("preserves empty lines from consecutive newlines", () => {
    expect(wrapTextLines("one\n\ntwo", 1000, measure)).toEqual([
      "one",
      "",
      "two",
    ]);
  });

  it("wraps words when a line would exceed maxWidth", () => {
    // "aaaa bbbb" measures 90px; maxWidth 50 fits one 4-char word per line.
    expect(wrapTextLines("aaaa bbbb cccc", 50, measure)).toEqual([
      "aaaa",
      "bbbb",
      "cccc",
    ]);
  });

  it("packs as many words as fit before breaking", () => {
    expect(wrapTextLines("aa bb cc dd", 60, measure)).toEqual([
      "aa bb",
      "cc dd",
    ]);
  });

  it("gives an overlong single word its own line instead of looping", () => {
    expect(wrapTextLines("tiny enormousword tiny", 60, measure)).toEqual([
      "tiny",
      "enormousword",
      "tiny",
    ]);
  });

  it("collapses runs of whitespace like HTML text rendering", () => {
    expect(wrapTextLines("one   two", 1000, measure)).toEqual(["one two"]);
  });
});

describe("computeObjectFit", () => {
  const box = { width: 200, height: 100 };
  const landscape = { width: 400, height: 100 };
  const square = { width: 50, height: 50 };

  it("fill stretches to the box by default", () => {
    expect(computeObjectFit(undefined, undefined, box, square)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 100,
    });
  });

  it("contain letterboxes and centers by default", () => {
    // 400x100 into 200x100: scale 0.5 -> 200x50, centered vertically.
    expect(computeObjectFit("contain", undefined, box, landscape)).toEqual({
      x: 0,
      y: 25,
      width: 200,
      height: 50,
    });
  });

  it("cover overflows the short axis and honors objectPosition keywords", () => {
    // 50x50 into 200x100: cover scale 4 -> 200x200; "left top" pins origin.
    expect(computeObjectFit("cover", "left top", box, square)).toEqual({
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    });
  });

  it("none keeps natural size and supports percentage positions", () => {
    // 50x50 at natural size; 100% x -> right edge, 50% y -> centered.
    expect(computeObjectFit("none", "100% 50%", box, square)).toEqual({
      x: 150,
      y: 25,
      width: 50,
      height: 50,
    });
  });

  it("scale-down never upscales but shrinks like contain", () => {
    expect(computeObjectFit("scale-down", undefined, box, square)).toEqual({
      x: 75,
      y: 25,
      width: 50,
      height: 50,
    });
    expect(computeObjectFit("scale-down", undefined, box, landscape)).toEqual({
      x: 0,
      y: 25,
      width: 200,
      height: 50,
    });
  });
});

describe("renderStill with image nodes", () => {
  it("fails loudly when an img node has no resolved asset", () => {
    const scene = {
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        pic: { id: "pic", type: "image", src: "data:image/png;base64,x" },
      },
      nodes: [{ id: "shot", type: "img", assetId: "pic" }],
    };

    // Minimal context stub: the error must fire before any drawing happens.
    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderStill(context, scene as never, 0)).toThrow(
      /resolveAssets\(scene\)/,
    );
  });
});

describe("parseLinearGradient", () => {
  it("returns null for non-gradient fills", () => {
    expect(parseLinearGradient("#ff0000")).toBeNull();
    expect(parseLinearGradient("rgba(0, 0, 0, 0.5)")).toBeNull();
  });

  it("defaults to 180deg (to bottom) when no direction is given", () => {
    expect(parseLinearGradient("linear-gradient(#000 0%, #fff 100%)")).toEqual({
      angleDeg: 180,
      stops: [
        { color: "#000", offset: 0 },
        { color: "#fff", offset: 1 },
      ],
    });
  });

  it("parses deg angles and to-side keywords", () => {
    expect(
      parseLinearGradient("linear-gradient(135deg, #000 0%, #fff 100%)")
        ?.angleDeg,
    ).toBe(135);
    expect(
      parseLinearGradient("linear-gradient(to right, #000 0%, #fff 100%)")
        ?.angleDeg,
    ).toBe(90);
  });

  it("handles many stops and rgba colors with embedded commas", () => {
    const parsed = parseLinearGradient(
      "linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, #00ff00 50%, rgb(0, 0, 255) 100%)",
    );

    expect(parsed?.stops).toEqual([
      { color: "rgba(255, 0, 0, 0.5)", offset: 0 },
      { color: "#00ff00", offset: 0.5 },
      { color: "rgb(0, 0, 255)", offset: 1 },
    ]);
  });

  it("distributes omitted stop positions evenly like CSS", () => {
    const parsed = parseLinearGradient(
      "linear-gradient(to right, #000, #888, #aaa, #fff)",
    );

    expect(parsed?.stops.map((stop) => stop.offset)).toEqual([
      0,
      1 / 3,
      2 / 3,
      1,
    ]);
  });

  it("clamps out-of-order positions to be non-decreasing", () => {
    const parsed = parseLinearGradient(
      "linear-gradient(#000 60%, #888 20%, #fff 100%)",
    );

    expect(parsed?.stops.map((stop) => stop.offset)).toEqual([0.6, 0.6, 1]);
  });
});
