import { describe, expect, it } from "vitest";
import { validateScene } from "@motionforge/schema";
import { showcaseScenes } from "./index.js";

describe("showcase scenes", () => {
  it("are schema-valid with stable ids", () => {
    expect(showcaseScenes.map((entry) => entry.id)).toEqual([
      "intro",
      "tiktok-captions",
      "karaoke-captions",
    ]);

    for (const entry of showcaseScenes) {
      const result = validateScene(entry.scene);
      expect(result.ok ? "ok" : result.errors.join("\n")).toBe("ok");
      expect(entry.posterFrame).toBeGreaterThanOrEqual(0);
      expect(entry.posterFrame).toBeLessThan(entry.scene.duration);
    }
  });

  it("uses measured caption backgrounds in the TikTok showcase", () => {
    const tiktok = showcaseScenes.find((entry) => entry.id === "tiktok-captions");
    const caption = tiktok?.scene.nodes.find((node) => node.id === "caption");
    const highlighted = caption?.children?.[1]?.children?.[0];

    expect(highlighted?.id).toBe("caption-w1-text");
    expect(highlighted?.style?.textBackgroundColor).toBe(
      "rgba(255, 209, 102, 0.16)",
    );
    expect(highlighted?.style?.textStroke).toBe("8px #000000");
  });
});
