import type { Scene } from "@motionforge/schema";

export type LocalMediaType = "image" | "video" | "audio";
export type LocalMediaAssetStatus = "probing" | "ready" | "error";

export type LocalMediaAsset = {
  id: string;
  sceneAssetId: string;
  type: LocalMediaType;
  file: File;
  objectUrl: string;
  label: string;
  aliases: string[];
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  waveformPeaks?: number[];
  status: LocalMediaAssetStatus;
  error?: string;
};

export type ChatMediaAssetManifestItem = {
  id: string;
  sceneAssetId: string;
  type: LocalMediaType;
  src: string;
  label: string;
  aliases: string[];
  fileName: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  alreadyInScene: boolean;
};

const extensionTypes: Record<string, LocalMediaType> = {
  avif: "image",
  gif: "image",
  jpeg: "image",
  jpg: "image",
  png: "image",
  svg: "image",
  webp: "image",
  aac: "audio",
  flac: "audio",
  m4a: "audio",
  mp3: "audio",
  ogg: "audio",
  opus: "audio",
  wav: "audio",
  m4v: "video",
  mov: "video",
  mp4: "video",
  mpeg: "video",
  mpg: "video",
  webm: "video",
};

const ordinalAliases = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
];

const ordinalPositions = [
  "zeroth",
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
];

export function localMediaTypeFromFile(file: Pick<File, "name" | "type">) {
  const mimePrefix = file.type.split("/")[0];

  if (
    mimePrefix === "image" ||
    mimePrefix === "video" ||
    mimePrefix === "audio"
  ) {
    return mimePrefix;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension ? extensionTypes[extension] ?? null : null;
}

export function createLocalMediaAssetShell({
  file,
  objectUrl,
  existingAssets,
}: {
  file: File;
  objectUrl: string;
  existingAssets: LocalMediaAsset[];
}): LocalMediaAsset | null {
  const type = localMediaTypeFromFile(file);

  if (!type) {
    return null;
  }

  const number = nextAssetNumber(existingAssets, type);
  const label = formatLocalMediaLabel(type, number);

  return {
    id: `${type}-${number}`,
    sceneAssetId: `${type}_${number}`,
    type,
    file,
    objectUrl,
    label,
    aliases: createLocalMediaAliases({
      type,
      number,
      label,
      fileName: file.name,
    }),
    fileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    status: "probing",
  };
}

export function createChatMediaAssetManifest({
  assets,
  scene,
}: {
  assets: LocalMediaAsset[];
  scene: Scene | null;
}): ChatMediaAssetManifestItem[] {
  return assets.map((asset) => ({
    id: asset.id,
    sceneAssetId: asset.sceneAssetId,
    type: asset.type,
    src: asset.objectUrl,
    label: asset.label,
    aliases: asset.aliases,
    fileName: asset.fileName,
    durationSeconds: asset.durationSeconds,
    width: asset.width,
    height: asset.height,
    alreadyInScene: isLocalMediaAssetUsed(asset, scene),
  }));
}

export function isLocalMediaAssetUsed(
  asset: Pick<LocalMediaAsset, "sceneAssetId">,
  scene: Scene | null,
) {
  return Boolean(scene?.assets[asset.sceneAssetId]);
}

export function revokeLocalMediaAssetUrls(
  asset: Pick<LocalMediaAsset, "objectUrl" | "thumbnailUrl">,
  revoke: (url: string) => void = URL.revokeObjectURL,
) {
  revoke(asset.objectUrl);
}

export async function probeLocalMediaAsset(
  asset: LocalMediaAsset,
): Promise<LocalMediaAsset> {
  try {
    switch (asset.type) {
      case "image":
        return { ...asset, ...(await probeImage(asset.objectUrl)), status: "ready" };
      case "video": {
        const metadata = await probeVideo(asset.objectUrl);
        return {
          ...asset,
          ...metadata,
          status: "ready",
        };
      }
      case "audio":
        return {
          ...asset,
          durationSeconds: await probeAudioDuration(asset.objectUrl),
          status: "ready",
        };
    }
  } catch (error) {
    return {
      ...asset,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function formatMediaDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) {
    return "unknown";
  }

  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const remainingSeconds = rounded % 60;

  if (hours > 0) {
    return `${hours}:${padTime(minutes)}:${padTime(remainingSeconds)}`;
  }

  return `${padTime(minutes)}:${padTime(remainingSeconds)}`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

function nextAssetNumber(
  assets: Array<Pick<LocalMediaAsset, "id" | "type">>,
  type: LocalMediaType,
) {
  let max = 0;

  for (const asset of assets) {
    if (asset.type !== type) {
      continue;
    }

    const match = asset.id.match(/-(\d+)$/);
    const number = match ? Number.parseInt(match[1] ?? "", 10) : 0;

    if (Number.isInteger(number) && number > max) {
      max = number;
    }
  }

  return max + 1;
}

function formatLocalMediaLabel(type: LocalMediaType, number: number) {
  const noun = type === "image" ? "Image" : type === "video" ? "Video" : "Audio";
  return `${noun} ${number}`;
}

function createLocalMediaAliases({
  type,
  number,
  label,
  fileName,
}: {
  type: LocalMediaType;
  number: number;
  label: string;
  fileName: string;
}) {
  const noun = type === "image" ? "image" : type === "video" ? "video" : "audio";
  const ordinal = ordinalAliases[number];
  const position = ordinalPositions[number];

  return uniqueAliases([
    label,
    label.toLowerCase(),
    `${noun} ${number}`,
    ordinal ? `${noun} ${ordinal}` : undefined,
    position ? `${position} ${noun}` : undefined,
    fileName,
    fileName.toLowerCase(),
    stripFileExtension(fileName),
  ]);
}

function uniqueAliases(values: Array<string | undefined>) {
  const aliases: string[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const normalized = value?.trim();

    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    aliases.push(normalized);
  }

  return aliases;
}

function stripFileExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index > 0 ? fileName.slice(0, index) : fileName;
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function probeImage(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => reject(new Error("Could not read image metadata."));
    image.src = src;
  });
}

function probeAudioDuration(src: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      cleanup();
      resolve(audio.duration);
    };
    audio.onerror = () => {
      cleanup();
      reject(new Error("Could not read audio metadata."));
    };

    const cleanup = () => {
      audio.removeAttribute("src");
      audio.load();
    };

    audio.src = src;
  });
}

function probeVideo(src: string): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
  thumbnailUrl?: string;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const finish = () => {
      const metadata = {
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        thumbnailUrl: captureVideoThumbnail(video),
      };
      cleanup();
      resolve(metadata);
    };

    video.onerror = () => {
      cleanup();
      reject(new Error("Could not read video metadata."));
    };

    video.onloadedmetadata = () => {
      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        finish();
        return;
      }

      const targetTime = Math.min(0.25, Math.max(0, video.duration - 0.05));

      if (targetTime <= 0) {
        finish();
        return;
      }

      video.currentTime = targetTime;
    };

    video.onseeked = finish;
    video.src = src;
  });
}

function captureVideoThumbnail(video: HTMLVideoElement): string | undefined {
  if (!video.videoWidth || !video.videoHeight) {
    return undefined;
  }

  const canvas = document.createElement("canvas");
  const maxWidth = 320;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    return undefined;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}
