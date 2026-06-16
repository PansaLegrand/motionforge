import type { EditorLayer } from "./layers";
import type { LocalMediaAsset } from "../media/assets";
import { formatMediaClock } from "../media/plan";

export type TimelineMediaInfo = {
  kind: "image" | "video" | "audio" | "lottie" | "other";
  label: string;
  thumbnailUrl?: string;
  sourceOffsetLabel?: string;
  detailLabel?: string;
};

export function describeTimelineMediaLayer({
  layer,
  mediaAssets,
}: {
  layer: EditorLayer;
  mediaAssets: LocalMediaAsset[];
}): TimelineMediaInfo {
  const mediaAsset = layer.assetId
    ? mediaAssets.find((asset) => asset.sceneAssetId === layer.assetId)
    : undefined;
  const kind = mediaKindForLayer(layer);
  const label = mediaAsset?.label ?? layer.label;
  const thumbnailUrl =
    mediaAsset?.thumbnailUrl ??
    (mediaAsset?.type === "image" ? mediaAsset.objectUrl : undefined) ??
    (layer.assetType === "image" ? layer.assetSrc : undefined);
  const sourceOffsetLabel = sourceOffsetForLayer(layer);
  const detailLabel = [sourceOffsetLabel, playbackLabel(layer), volumeLabel(layer)]
    .filter(Boolean)
    .join(" · ");

  return {
    kind,
    label,
    thumbnailUrl,
    sourceOffsetLabel,
    detailLabel: detailLabel || undefined,
  };
}

function mediaKindForLayer(layer: EditorLayer): TimelineMediaInfo["kind"] {
  if (layer.type === "img") {
    return "image";
  }

  if (
    layer.type === "video" ||
    layer.type === "audio" ||
    layer.type === "lottie"
  ) {
    return layer.type;
  }

  return "other";
}

function sourceOffsetForLayer(layer: EditorLayer) {
  if (layer.type === "video" && layer.videoStartTime !== undefined) {
    return `src ${formatMediaClock(layer.videoStartTime)}`;
  }

  if (layer.type === "audio" && layer.audioStartTime !== undefined) {
    return `src ${formatMediaClock(layer.audioStartTime)}`;
  }

  return undefined;
}

function playbackLabel(layer: EditorLayer) {
  if (
    (layer.type === "video" || layer.type === "lottie") &&
    layer.playbackRate !== undefined &&
    layer.playbackRate !== 1
  ) {
    return `${formatCompactNumber(layer.playbackRate)}x`;
  }

  return undefined;
}

function volumeLabel(layer: EditorLayer) {
  if (
    (layer.type === "video" || layer.type === "audio") &&
    layer.volume !== undefined &&
    layer.volume !== 1
  ) {
    return `vol ${Math.round(layer.volume * 100)}%`;
  }

  return undefined;
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(2).replace(/0+$/, "");
}
