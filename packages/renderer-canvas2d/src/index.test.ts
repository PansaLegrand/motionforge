import { describe, expect, it } from "vitest";
import { sampleScene } from "@motionforge/core";
import {
  computeObjectFit,
  lottieSourceFrame,
  parseBorder,
  parseBoxShadow,
  parseLinearGradient,
  parseTextBackground,
  parseTextStroke,
  renderStill,
  validateLottieDocument,
  videoSourceTime,
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

  it("breaks an overlong single word by grapheme instead of squishing", () => {
    expect(wrapTextLines("tiny enormousword tiny", 60, measure)).toEqual([
      "tiny",
      "enormo",
      "usword",
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

describe("parseTextStroke", () => {
  it("returns null when no stroke is provided", () => {
    expect(parseTextStroke(undefined)).toBeNull();
    expect(parseTextStroke("")).toBeNull();
  });

  it("parses width and color shorthand", () => {
    expect(parseTextStroke("4px #000000", 40)).toEqual({
      width: 4,
      color: "#000000",
    });
  });

  it("resolves percentages against font size and preserves color strings", () => {
    expect(parseTextStroke("10% rgba(0, 0, 0, 0.8)", 40)).toEqual({
      width: 4,
      color: "rgba(0, 0, 0, 0.8)",
    });
  });

  it("ignores malformed and non-positive strokes", () => {
    expect(parseTextStroke("nope")).toBeNull();
    expect(parseTextStroke("0px #000000")).toBeNull();
    expect(parseTextStroke("-2px #000000")).toBeNull();
  });
});

describe("parseTextBackground", () => {
  it("returns null without a background color", () => {
    expect(parseTextBackground({})).toBeNull();
  });

  it("parses fitted text background controls", () => {
    expect(
      parseTextBackground(
        {
          textBackgroundColor: "rgba(255, 209, 102, 0.16)",
          textBackgroundPaddingX: 24,
          textBackgroundPaddingY: "10%",
          textBackgroundRadius: "8px",
        },
        40,
      ),
    ).toEqual({
      color: "rgba(255, 209, 102, 0.16)",
      paddingX: 24,
      paddingY: 4,
      radius: 8,
    });
  });

  it("uses shared padding as the axis fallback and clamps negative values", () => {
    expect(
      parseTextBackground(
        {
          textBackgroundColor: "#111111",
          textBackgroundPadding: 12,
          textBackgroundPaddingX: -4,
          textBackgroundRadius: -2,
        },
        40,
      ),
    ).toEqual({
      color: "#111111",
      paddingX: 0,
      paddingY: 12,
      radius: 0,
    });
  });
});

describe("videoSourceTime", () => {
  it("maps local frames to source seconds at natural speed", () => {
    expect(videoSourceTime(0, 30, 0, 1, 10)).toBe(0);
    expect(videoSourceTime(15, 30, 0, 1, 10)).toBe(0.5);
  });

  it("applies trim offset and playback rate", () => {
    // 0.5s trim + (15/30)s * 2x = 1.5s into the source.
    expect(videoSourceTime(15, 30, 0.5, 2, 10)).toBe(1.5);
  });

  it("holds the last frame when the scene outlasts the clip", () => {
    expect(videoSourceTime(900, 30, 0, 1, 2)).toBeCloseTo(1.999, 5);
    expect(videoSourceTime(0, 30, 99, 1, 2)).toBeCloseTo(1.999, 5);
  });
});

describe("renderStill with video nodes", () => {
  it("fails loudly when no frame was staged via prepareFrame", () => {
    const scene = {
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {
        clip: { id: "clip", type: "video", src: "blob:fake" },
      },
      nodes: [{ id: "shot", type: "video", assetId: "clip" }],
    };

    const context = {
      globalAlpha: 1,
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    expect(() => renderStill(context, scene as never, 0)).toThrow(
      /prepareFrame\(scene, frame, assets\)/,
    );
  });
});

describe("renderStill bounded text", () => {
  it("draws only maxLines and ellipsizes the final visible line", () => {
    const drawn: string[] = [];
    const scene = {
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "title",
          type: "text",
          text: "aaaa bbbb cccc",
          style: {
            width: 50,
            fontSize: 20,
            maxLines: 2,
            textOverflow: "ellipsis",
          },
        },
      ],
    };

    const context = {
      globalAlpha: 1,
      font: "",
      fillStyle: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      translate: () => undefined,
      measureText: (line: string) => ({
        width: Array.from(line).length * 10,
      }),
      fillText: (line: string) => {
        drawn.push(line);
      },
    } as unknown as CanvasRenderingContext2D;

    renderStill(context, scene as never, 0);

    expect(drawn).toEqual(["aaaa", "bbbb…"]);
  });
});

describe("parseBoxShadow", () => {
  it("parses offset/blur/color forms", () => {
    expect(parseBoxShadow("2px 4px 8px rgba(0, 0, 0, 0.5)")).toEqual({
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      color: "rgba(0, 0, 0, 0.5)",
    });
    expect(parseBoxShadow("0 6 #000000")).toEqual({
      offsetX: 0,
      offsetY: 6,
      blur: 0,
      color: "#000000",
    });
    expect(parseBoxShadow("-3px -3px 10px gold")).toEqual({
      offsetX: -3,
      offsetY: -3,
      blur: 10,
      color: "gold",
    });
  });

  it("rejects inset, spread, and incomplete values", () => {
    expect(parseBoxShadow("inset 2px 2px 4px #000")).toBeNull();
    expect(parseBoxShadow("2px 2px 4px 6px #000")).toBeNull();
    expect(parseBoxShadow("2px #000")).toBeNull();
    expect(parseBoxShadow("2px 2px 4px")).toBeNull();
  });
});

describe("parseBorder", () => {
  it("parses width/solid/color in any practical order", () => {
    expect(parseBorder("2px solid #ff0000")).toEqual({
      width: 2,
      color: "#ff0000",
    });
    expect(parseBorder("3 rgb(10, 20, 30)")).toEqual({
      width: 3,
      color: "rgb(10, 20, 30)",
    });
  });

  it("rejects non-solid line styles and missing parts", () => {
    expect(parseBorder("2px dashed #fff")).toBeNull();
    expect(parseBorder("solid #fff")).toBeNull();
    expect(parseBorder("2px solid")).toBeNull();
    expect(parseBorder("0 solid #fff")).toBeNull();
  });
});

describe("zIndex paint order", () => {
  it("paints siblings in ascending zIndex order, document order for ties", () => {
    const fills: string[] = [];
    const scene = {
      schemaVersion: 0,
      width: 100,
      height: 100,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        { id: "top", type: "div", style: { width: 10, height: 10, backgroundColor: "#aa0000", zIndex: 5 } },
        { id: "bottom", type: "div", style: { width: 10, height: 10, backgroundColor: "#00bb00", zIndex: -1 } },
        { id: "mid-a", type: "div", style: { width: 10, height: 10, backgroundColor: "#0000cc" } },
        { id: "mid-b", type: "div", style: { width: 10, height: 10, backgroundColor: "#dd00dd" } },
      ],
    };

    const context = {
      globalAlpha: 1,
      set fillStyle(value: string) {
        fills.push(value);
      },
      save: () => undefined,
      restore: () => undefined,
      clearRect: () => undefined,
      fillRect: () => undefined,
      translate: () => undefined,
    } as unknown as CanvasRenderingContext2D;

    renderStill(context, scene as never, 0);

    expect(fills).toEqual(["#00bb00", "#0000cc", "#dd00dd", "#aa0000"]);
  });
});

describe("lottieSourceFrame", () => {
  const clip = { fr: 60, ip: 0, op: 120 };

  it("maps scene-local frames through fps, rate, and lottie frame rate", () => {
    expect(lottieSourceFrame(0, 30, 1, clip)).toBe(0);
    expect(lottieSourceFrame(15, 30, 1, clip)).toBe(30); // 0.5s x 60fr
    expect(lottieSourceFrame(15, 30, 2, clip)).toBe(60);
  });

  it("clamps to the last frame — lottie-web does not clamp itself", () => {
    expect(lottieSourceFrame(900, 30, 1, clip)).toBeCloseTo(119.999, 3);
    expect(lottieSourceFrame(-5, 30, 1, clip)).toBe(0);
  });

  it("respects a nonzero in-point when clamping", () => {
    expect(lottieSourceFrame(900, 30, 1, { fr: 30, ip: 20, op: 50 })).toBeCloseTo(
      29.999,
      3,
    );
  });
});

describe("validateLottieDocument", () => {
  const minimal = { v: "5.7.4", fr: 30, ip: 0, op: 60, w: 100, h: 100, layers: [{ ty: 4 }] };

  it("accepts a self-contained vector document", () => {
    expect(validateLottieDocument(minimal)).toEqual([]);
  });

  it("rejects non-lottie JSON and external images", () => {
    expect(validateLottieDocument({ hello: 1 })).toContain(
      "missing fr/op — not a Lottie animation document",
    );
    expect(
      validateLottieDocument({
        ...minimal,
        assets: [{ id: "img_0", p: "image.png", u: "images/" }],
      }).join(" "),
    ).toContain('external image "image.png"');
  });

  it("rejects image layers and expressions", () => {
    expect(
      validateLottieDocument({ ...minimal, layers: [{ ty: 2 }] }).join(" "),
    ).toContain("image layer");

    const withExpression = {
      ...minimal,
      layers: [
        { ty: 4, ks: { p: { a: 0, k: [0, 0], x: "var $bm_rt = wiggle(2, 30);" } } },
      ],
    };
    expect(validateLottieDocument(withExpression).join(" ")).toContain(
      "expressions",
    );
    // bezier easing objects use numeric/array "x" — those must pass
    const withEasing = {
      ...minimal,
      layers: [{ ty: 4, ks: { p: { a: 1, k: [{ t: 0, i: { x: [0.5], y: [0.5] } }] } } }],
    };
    expect(validateLottieDocument(withEasing)).toEqual([]);
  });
});

describe("wrapTextLines with spaceless scripts", () => {
  // 10px per code point, like the Latin fake measurer above.
  const measureCjk = (line: string): number => Array.from(line).length * 10;

  it("breaks a spaceless CJK paragraph into fitting lines", () => {
    const text = "这是一个很长的中文段落用来测试文本换行";
    const lines = wrapTextLines(text, 80, measureCjk); // 8 chars per line

    expect(lines).toEqual(["这是一个很长的中", "文段落用来测试文", "本换行"]);
    expect(lines.every((line) => measureCjk(line) <= 80)).toBe(true);
  });

  it("mixes spaced and spaceless runs", () => {
    const lines = wrapTextLines("emoji 中文混合测试段落在这里", 80, measureCjk);
    // word-level breaks drop the inter-word space, as they always have
    expect(lines).toEqual(["emoji", "中文混合测试段落", "在这里"]);
    expect(lines.every((line) => measureCjk(line) <= 80)).toBe(true);
  });

  it("keeps emoji grapheme clusters intact when breaking", () => {
    // Each flag emoji is two code points (one grapheme may be wider);
    // ensure no break lands inside a surrogate pair.
    const text = "🎬🎬🎬🎬🎬🎬";
    const lines = wrapTextLines(text, 45, (line) => Array.from(line).length * 10);
    for (const line of lines) {
      expect([...line].every((ch) => ch === "🎬")).toBe(true);
    }
  });

  it("clamps a single grapheme wider than the box (unchanged behavior)", () => {
    expect(wrapTextLines("字", 5, measureCjk)).toEqual(["字"]);
  });

  it("Latin wrapping is byte-identical to the previous behavior", () => {
    const measure = (line: string): number => line.length * 10;
    expect(wrapTextLines("the quick brown fox jumps", 100, measure)).toEqual([
      "the quick",
      "brown fox",
      "jumps",
    ]);
  });
});
