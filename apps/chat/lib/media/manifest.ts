import type { ChatMediaAssetManifestItem, LocalMediaType } from "./assets";

export function readChatMediaAssetManifest(
  input: unknown,
): ChatMediaAssetManifestItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const candidate = item as Record<string, unknown>;
    const id = readString(candidate.id);
    const sceneAssetId = readString(candidate.sceneAssetId);
    const type = readMediaType(candidate.type);
    const src = readString(candidate.src);
    const label = readString(candidate.label);
    const fileName = readString(candidate.fileName);

    if (!id || !sceneAssetId || !type || !src || !label || !fileName) {
      return [];
    }

    return [
      {
        id,
        sceneAssetId,
        type,
        src,
        label,
        aliases: Array.isArray(candidate.aliases)
          ? candidate.aliases.flatMap((value) => {
              const alias = readString(value);
              return alias ? [alias] : [];
            })
          : [],
        fileName,
        durationSeconds: readOptionalNumber(candidate.durationSeconds),
        width: readOptionalNumber(candidate.width),
        height: readOptionalNumber(candidate.height),
        alreadyInScene: candidate.alreadyInScene === true,
      },
    ];
  });
}

export function formatMediaAssetManifestForPrompt(
  assets: ChatMediaAssetManifestItem[],
) {
  if (!assets.length) {
    return "No uploaded media assets are available.";
  }

  return JSON.stringify(
    assets.map((asset) => ({
      id: asset.id,
      sceneAssetId: asset.sceneAssetId,
      type: asset.type,
      src: asset.src,
      label: asset.label,
      aliases: asset.aliases,
      fileName: asset.fileName,
      durationSeconds: asset.durationSeconds,
      width: asset.width,
      height: asset.height,
      alreadyInScene: asset.alreadyInScene,
    })),
    null,
    2,
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readMediaType(value: unknown): LocalMediaType | null {
  return value === "image" || value === "video" || value === "audio"
    ? value
    : null;
}
