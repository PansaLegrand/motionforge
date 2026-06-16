import type { ChatMediaAssetManifestItem } from "./assets";

export type ParsedMediaMention = {
  raw: string;
  assetId: string;
  label: string;
  range?: {
    startSeconds: number;
    endSeconds: number;
  };
};

export function parseMediaMentions(
  input: string,
  assets: ChatMediaAssetManifestItem[],
): ParsedMediaMention[] {
  const mentions: ParsedMediaMention[] = [];

  for (const asset of assets) {
    for (const alias of mentionAliasesForAsset(asset)) {
      const escaped = escapeRegex(alias);
      const pattern = new RegExp(
        `@${escaped}(?:\\[(\\d{1,2}:\\d{2}|\\d+(?:\\.\\d+)?)\\s*-\\s*(\\d{1,2}:\\d{2}|\\d+(?:\\.\\d+)?)\\])?`,
        "gi",
      );
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(input))) {
        const raw = match[0];
        const start = match[1];
        const end = match[2];

        mentions.push({
          raw,
          assetId: asset.id,
          label: asset.label,
          ...(start && end
            ? {
                range: {
                  startSeconds: parseTimecodeSeconds(start),
                  endSeconds: parseTimecodeSeconds(end),
                },
              }
            : {}),
        });
      }
    }
  }

  return dedupeMentions(mentions);
}

export function resolveMediaAssetAlias(
  input: string,
  assets: ChatMediaAssetManifestItem[],
): ChatMediaAssetManifestItem | null {
  const normalizedInput = normalizeAlias(input);

  for (const asset of assets) {
    if (
      [asset.id, asset.sceneAssetId, asset.label, asset.fileName, ...asset.aliases]
        .map(normalizeAlias)
        .includes(normalizedInput)
    ) {
      return asset;
    }
  }

  return null;
}

export function mediaMentionToken(asset: ChatMediaAssetManifestItem) {
  return `@${asset.label}`;
}

function mentionAliasesForAsset(asset: ChatMediaAssetManifestItem) {
  return [
    asset.id,
    asset.sceneAssetId,
    asset.label,
    asset.fileName,
    ...asset.aliases,
  ]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

function parseTimecodeSeconds(value: string) {
  const trimmed = value.trim();
  const parts = trimmed.split(":");

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);
    return minutes * 60 + seconds;
  }

  return Number(trimmed);
}

function dedupeMentions(mentions: ParsedMediaMention[]) {
  const seen = new Set<string>();
  const unique: ParsedMediaMention[] = [];

  for (const mention of mentions) {
    const key = `${mention.raw}:${mention.assetId}:${mention.range?.startSeconds ?? ""}:${mention.range?.endSeconds ?? ""}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    unique.push(mention);
  }

  return unique.sort((a, b) => a.raw.localeCompare(b.raw));
}

function normalizeAlias(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/\s+/g, " ");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
