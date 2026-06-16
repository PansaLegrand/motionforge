import { describe, expect, it } from "vitest";
import type { ChatMediaAssetManifestItem } from "./assets";
import {
  mediaMentionToken,
  parseMediaMentions,
  resolveMediaAssetAlias,
} from "./mentions";

describe("media mention helpers", () => {
  const assets: ChatMediaAssetManifestItem[] = [
    {
      id: "video-1",
      sceneAssetId: "video_1",
      type: "video",
      src: "blob:video-1",
      label: "Video 1",
      aliases: ["video one", "first video", "Beach Day.mp4"],
      fileName: "Beach Day.mp4",
      durationSeconds: 12,
      width: 1920,
      height: 1080,
      alreadyInScene: false,
    },
    {
      id: "audio-1",
      sceneAssetId: "audio_1",
      type: "audio",
      src: "blob:audio-1",
      label: "Audio 1",
      aliases: ["audio one"],
      fileName: "voice.wav",
      alreadyInScene: true,
    },
  ];

  it("parses explicit asset mentions with optional time ranges", () => {
    expect(
      parseMediaMentions("Use @Video 1[00:05-00:10] with @voice.wav", assets),
    ).toEqual([
      {
        raw: "@Video 1[00:05-00:10]",
        assetId: "video-1",
        label: "Video 1",
        range: { startSeconds: 5, endSeconds: 10 },
      },
      {
        raw: "@voice.wav",
        assetId: "audio-1",
        label: "Audio 1",
      },
    ]);
  });

  it("resolves natural aliases and generated mention tokens", () => {
    expect(resolveMediaAssetAlias("video one", assets)?.id).toBe("video-1");
    expect(resolveMediaAssetAlias("@Beach Day.mp4", assets)?.id).toBe(
      "video-1",
    );
    expect(resolveMediaAssetAlias("missing", assets)).toBeNull();
    expect(mediaMentionToken(assets[0]!)).toBe("@Video 1");
  });
});
