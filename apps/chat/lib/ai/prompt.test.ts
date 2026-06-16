import { describe, expect, it } from "vitest";
import { buildMotionforgeSystemPrompt } from "./prompt";

describe("buildMotionforgeSystemPrompt", () => {
  it("includes uploaded media manifest and rules", () => {
    const prompt = buildMotionforgeSystemPrompt(null, [
      {
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video",
        src: "blob:video-1",
        label: "Video 1",
        aliases: ["video one"],
        fileName: "clip.mp4",
        durationSeconds: 8,
        width: 1920,
        height: 1080,
        alreadyInScene: false,
      },
    ]);

    expect(prompt).toContain("Uploaded media rules");
    expect(prompt).toContain('"sceneAssetId": "video_1"');
    expect(prompt).toContain("Use videoStartTime in seconds");
    expect(prompt).toContain("setNodeProps");
    expect(prompt).toContain('whose assetId is "video_1"');
  });
});
