import { describe, expect, it } from "vitest";
import { validateScene, type Scene, type SceneNode } from "@motionforge/schema";
import {
  fadeUp,
  captionTemplateEntries,
  captionTemplates,
  karaokeCaptions,
  popIn,
  pulse,
  slideIn,
  styledCaptions,
  styledSubtitles,
  subtitleTemplates,
  tiktokCaptions,
  type CaptionWord,
} from "./index.js";

function sceneWith(...nodes: SceneNode[]): Scene {
  return {
    schemaVersion: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 180,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      },
      ...nodes,
    ],
  } as Scene;
}

const words: CaptionWord[] = [
  { word: "FORGE", startMs: 800, endMs: 1600 },
  { word: "MOTION", startMs: 1600, endMs: 2400 },
  { word: "IN", startMs: 2400, endMs: 3200 },
  { word: "THE", startMs: 3200, endMs: 4000 },
  { word: "BROWSER", startMs: 4000, endMs: 5000 },
];

describe("motion presets", () => {
  it("emit schema-valid, strictly increasing keyframes", () => {
    const node: SceneNode = {
      id: "box",
      type: "div",
      style: { width: 100, height: 100 },
      animations: [
        ...popIn(),
        ...fadeUp({ delay: 6 }),
        ...slideIn("left", { distance: 200 }),
        ...pulse({ peak: 1.2 }),
      ],
    };

    const result = validateScene(sceneWith(node));
    expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
  });

  it("delay holds the starting value from frame 0", () => {
    const [transform] = fadeUp({ delay: 8, durationInFrames: 10 });

    expect(transform?.frames[0]).toEqual({
      frame: 0,
      value: "translate(0px, 40px)",
    });
    expect(transform?.frames[1]?.frame).toBe(8);
    expect(transform?.frames[2]?.frame).toBe(18);
  });

  it("popIn uses transform tweens, not fontSize workarounds", () => {
    const animations = popIn({ fromScale: 0.5, durationInFrames: 8 });
    const transform = animations.find(
      (entry) => entry.property === "transform",
    );

    expect(transform?.frames[0]?.value).toBe("scale(0.5)");
    expect(transform?.frames[1]).toMatchObject({
      frame: 8,
      value: "scale(1)",
      easing: "spring(0.3)",
    });
  });
});

describe("tiktokCaptions", () => {
  // The acceptance test from the roadmap: the TikTok example's caption track,
  // regenerated from a handful of lines instead of ~300 lines of JSON.
  const captions = tiktokCaptions(words, {
    fps: 30,
    highlightIndices: [1, 4],
    area: { top: 760, height: 360 },
  });

  it("produces a schema-valid caption track", () => {
    const result = validateScene(sceneWith(captions));
    expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
  });

  it("maps millisecond timing onto frames", () => {
    const children = captions.children ?? [];

    expect(children).toHaveLength(5);
    // 800ms at 30fps -> frame 24; held until the next word at 1600ms -> 24 frames.
    expect(children[0]).toMatchObject({ from: 24, duration: 24 });
    // Last word runs to its own endMs: 4000ms -> 120, 5000ms -> 150.
    expect(children[4]).toMatchObject({ from: 120, duration: 30 });
  });

  it("adds fitted backgrounds and strokes to highlighted words", () => {
    const children = captions.children ?? [];
    const highlighted = children[1]?.children?.[0];
    const plain = children[0]?.children?.[0];

    expect(highlighted?.id).toBe("caption-w1-text");
    expect(highlighted?.style?.color).toBe("#ffd166");
    expect(highlighted?.style?.textStroke).toBe("8px #000000");
    expect(highlighted?.style?.textBackgroundColor).toBe(
      "rgba(255, 209, 102, 0.16)",
    );
    expect(highlighted?.style?.textBackgroundPaddingX).toBe(56);
    expect(highlighted?.style?.textBackgroundPaddingY).toBe(25);
    expect(highlighted?.style?.textBackgroundRadius).toBe(36);
    expect(plain?.id).toBe("caption-w0-text");
    expect(plain?.style?.color).toBe("#ffffff");
    expect(plain?.style?.textStroke).toBe("8px #000000");
    expect(plain?.style?.textBackgroundColor).toBeUndefined();
  });
});

describe("karaokeCaptions", () => {
  const line = karaokeCaptions(words, { fps: 30 });

  it("produces a schema-valid line spanning the spoken range", () => {
    const result = validateScene(sceneWith(line));

    expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    expect(line.from).toBe(24);
    expect(line.duration).toBe(126);
  });

  it("ramps each word to the highlight color during its span", () => {
    const second = line.children?.[1];
    const colors = second?.animations?.[0]?.frames ?? [];

    // Word 1: 1600ms -> line-local frame 24, end 2400ms -> 48.
    expect(colors.map((frame) => [frame.frame, frame.value])).toEqual([
      [0, "#ffffff"],
      [22, "#ffffff"],
      [24, "#ffd166"],
      [48, "#ffd166"],
      [50, "#ffffff"],
    ]);
    expect(second?.style?.textStroke).toBe("8px #000000");
  });
});

describe("caption template catalog", () => {
  it("exposes community subtitle templates with stable metadata", () => {
    expect(captionTemplateEntries.map(([key]) => key)).toEqual([
      "classic",
      "minimalBar",
      "handwritten",
      "retro",
      "cinematic",
      "storyteller",
      "hustle",
      "spotlight",
      "karaoke",
      "neon",
      "future",
      "terminal",
      "colorShift",
    ]);
    expect(subtitleTemplates).toBe(captionTemplates);
  });

  it("generates schema-valid styled captions for every template", () => {
    for (const [key] of captionTemplateEntries) {
      const captions = styledCaptions(words, {
        fps: 30,
        template: key,
        idPrefix: `community-${key}`,
      });
      const result = validateScene(sceneWith(captions));

      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
    }
  });

  it("segments static subtitle templates into readable line captions", () => {
    const captions = styledSubtitles(words, {
      fps: 30,
      template: "classic",
      maxWordsPerSegment: 2,
      idPrefix: "classic-demo",
    });

    expect(captions.children).toHaveLength(3);
    expect(captions.children?.[0]).toMatchObject({ from: 24, duration: 48 });
    expect(captions.children?.[0]?.children?.[0]?.text).toBe("FORGE MOTION");
    expect(captions.children?.[2]?.children?.[0]?.text).toBe("BROWSER");
  });

  it("adds animated active-word backgrounds for karaoke-style templates", () => {
    const captions = styledCaptions(words, {
      fps: 30,
      template: "karaoke",
      idPrefix: "karaoke-demo",
    });
    const firstSegment = captions.children?.[0];
    const firstWord = firstSegment?.children?.[0];

    expect(firstSegment?.type).toBe("div");
    expect(firstWord?.type).toBe("text");
    expect(firstWord?.style?.textBackgroundColor).toBe("rgba(236, 72, 153, 0)");
    expect(
      firstWord?.animations?.some((entry) => entry.property === "color"),
    ).toBe(true);
    expect(
      firstWord?.animations?.some(
        (entry) => entry.property === "textBackgroundColor",
      ),
    ).toBe(true);
  });

  it("keeps one-word punch templates compatible with tiktok-style timing", () => {
    const captions = styledCaptions(words, {
      fps: 30,
      template: "hustle",
      idPrefix: "hustle-demo",
    });
    const children = captions.children ?? [];
    const firstText = children[0]?.children?.[0];

    expect(children).toHaveLength(words.length);
    expect(children[0]).toMatchObject({ from: 24, duration: 24 });
    expect(firstText?.style?.textBackgroundColor).toBe("#ff3b30");
    expect(
      firstText?.animations?.some((entry) => entry.property === "transform"),
    ).toBe(true);
  });
});
