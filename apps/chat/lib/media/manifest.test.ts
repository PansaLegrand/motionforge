import { describe, expect, it } from "vitest";
import {
  formatMediaAssetManifestForPrompt,
  readChatMediaAssetManifest,
} from "./manifest";

describe("chat media asset manifest", () => {
  it("sanitizes unknown request payloads", () => {
    expect(
      readChatMediaAssetManifest([
        {
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          src: "blob:video-1",
          label: "Video 1",
          aliases: ["video one", 123],
          fileName: "clip.mp4",
          durationSeconds: 7.5,
          width: 1920,
          height: 1080,
          alreadyInScene: true,
        },
        { id: "bad", type: "video" },
        null,
      ]),
    ).toEqual([
      {
        id: "video-1",
        sceneAssetId: "video_1",
        type: "video",
        src: "blob:video-1",
        label: "Video 1",
        aliases: ["video one"],
        fileName: "clip.mp4",
        durationSeconds: 7.5,
        width: 1920,
        height: 1080,
        alreadyInScene: true,
      },
    ]);
  });

  it("formats a compact prompt payload", () => {
    const formatted = formatMediaAssetManifestForPrompt([
      {
        id: "image-1",
        sceneAssetId: "image_1",
        type: "image",
        src: "blob:image-1",
        label: "Image 1",
        aliases: ["logo"],
        fileName: "logo.png",
        width: 640,
        height: 480,
        alreadyInScene: false,
      },
    ]);

    expect(formatted).toContain('"src": "blob:image-1"');
    expect(formatMediaAssetManifestForPrompt([])).toBe(
      "No uploaded media assets are available.",
    );
  });
});
