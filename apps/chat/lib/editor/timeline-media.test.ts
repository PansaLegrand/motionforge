import { describe, expect, it } from "vitest";
import type { EditorLayer } from "./layers";
import type { LocalMediaAsset } from "../media/assets";
import { describeTimelineMediaLayer } from "./timeline-media";

describe("describeTimelineMediaLayer", () => {
  it("uses local asset labels and source trim detail for video layers", () => {
    expect(
      describeTimelineMediaLayer({
        layer: layer({
          type: "video",
          assetId: "video_1",
          videoStartTime: 5,
          playbackRate: 1.25,
          volume: 0.5,
        }),
        mediaAssets: [
          mediaAsset({
            id: "video-1",
            sceneAssetId: "video_1",
            type: "video",
            label: "Video 1",
            thumbnailUrl: "blob:thumb",
          }),
        ],
      }),
    ).toMatchObject({
      kind: "video",
      label: "Video 1",
      thumbnailUrl: "blob:thumb",
      sourceOffsetLabel: "src 00:05",
      detailLabel: "src 00:05 · 1.25x · vol 50%",
    });
  });

  it("uses image object URLs as thumbnails and audio source detail", () => {
    expect(
      describeTimelineMediaLayer({
        layer: layer({ type: "img", assetId: "image_1" }),
        mediaAssets: [
          mediaAsset({
            id: "image-1",
            sceneAssetId: "image_1",
            type: "image",
            label: "Image 1",
            objectUrl: "blob:image",
          }),
        ],
      }).thumbnailUrl,
    ).toBe("blob:image");

    expect(
      describeTimelineMediaLayer({
        layer: layer({
          type: "audio",
          assetId: "audio_1",
          audioStartTime: 12.5,
          volume: 0.35,
        }),
        mediaAssets: [],
      }),
    ).toMatchObject({
      kind: "audio",
      detailLabel: "src 00:12.5 · vol 35%",
    });
  });
});

function layer(overrides: Partial<EditorLayer>): EditorLayer {
  return {
    id: "node",
    type: "video",
    label: "video · video_1",
    depth: 0,
    parentFrom: 0,
    localFrom: 0,
    localDuration: 90,
    from: 0,
    duration: 90,
    end: 90,
    zIndex: 0,
    paintIndex: 0,
    childCount: 0,
    ...overrides,
  };
}

function mediaAsset(overrides: Partial<LocalMediaAsset>): LocalMediaAsset {
  return {
    id: "video-1",
    sceneAssetId: "video_1",
    type: "video",
    file: {} as File,
    objectUrl: "blob:asset",
    label: "Video 1",
    aliases: [],
    fileName: "asset.mp4",
    mimeType: "video/mp4",
    sizeBytes: 100,
    status: "ready",
    ...overrides,
  };
}
