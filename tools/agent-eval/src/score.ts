import {
  applyScenePatch,
  validateScene,
  type Scene,
  type SceneOp,
  type ScenePatch,
} from "@motionforge/schema";
import type { EditCase, EvalCase, EvalMediaAsset } from "./cases.js";

export type CaseResult = {
  id: string;
  suite: "generate" | "edit";
  pass: boolean;
  failures: string[];
};

/**
 * Pulls the first JSON value out of a model reply: tolerates code fences and
 * prose around the JSON, because that is what models actually emit.
 */
export function extractJson(reply: string): unknown | undefined {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = fenced?.[1] ? [fenced[1]] : [];

  // Fall back to the first {...} or [...] span balanced from the outside.
  const start = reply.search(/[[{]/);
  if (start !== -1) {
    candidates.push(reply.slice(start));
  }

  for (const candidate of candidates) {
    const trimmed = candidate.trim();

    // Try whole, then progressively trim trailing junk after the JSON.
    for (let end = trimmed.length; end > 0; end -= 1) {
      const ch = trimmed[end - 1];
      if (ch !== "}" && ch !== "]") continue;
      try {
        return JSON.parse(trimmed.slice(0, end));
      } catch {
        // keep shrinking
      }
    }
  }

  return undefined;
}

/** Scores one model reply against its case. Pure — the judge is mechanical. */
export function scoreReply(evalCase: EvalCase, reply: string): CaseResult {
  const failures: string[] = [];
  const json = extractJson(reply);

  if (json === undefined) {
    return fail(evalCase, ["reply contained no parseable JSON"]);
  }

  if (evalCase.suite === "generate") {
    const result = validateScene(json);

    if (!result.ok) {
      return fail(evalCase, result.errors.map((e) => `validateScene: ${e}`));
    }

    failures.push(...evalCase.assert(result.scene));
    return done(evalCase, failures);
  }

  // edit suite: the reply must be a patch op list applied to the case scene.
  const repaired = repairMediaPatch({
    scene: evalCase.scene,
    patchInput: json,
    mediaAssets: evalCase.mediaAssets ?? [],
  });

  if (!repaired.ok) {
    return fail(
      evalCase,
      repaired.errors.map((error) => `repairMediaPatch: ${error}`),
    );
  }

  const result = applyScenePatch(evalCase.scene, repaired.patch);

  if (!result.ok) {
    return fail(
      evalCase,
      result.errors.map((e) => `applyScenePatch: ${e.message}`),
    );
  }

  failures.push(...evalCase.assert(evalCase.scene as Scene, result.scene));
  return done(evalCase, failures);
}

function fail(evalCase: EvalCase, failures: string[]): CaseResult {
  return { id: evalCase.id, suite: evalCase.suite, pass: false, failures };
}

function done(evalCase: EvalCase, failures: string[]): CaseResult {
  return {
    id: evalCase.id,
    suite: evalCase.suite,
    pass: failures.length === 0,
    failures,
  };
}

function repairMediaPatch({
  scene,
  patchInput,
  mediaAssets,
}: {
  scene: Scene;
  patchInput: unknown;
  mediaAssets: EditCase["mediaAssets"];
}):
  | { ok: true; patch: ScenePatch }
  | { ok: false; errors: string[] } {
  if (!Array.isArray(patchInput)) {
    return { ok: false, errors: ["Model patch must be an array of ops."] };
  }

  const repaired: ScenePatch = [];
  const knownSceneAssets = new Set(Object.keys(scene.assets));
  const emittedAssets = new Set<string>();

  for (const [index, opInput] of patchInput.entries()) {
    if (!opInput || typeof opInput !== "object") {
      return { ok: false, errors: [`Patch op ${index} must be an object.`] };
    }

    const op = opInput as Record<string, unknown>;

    if (op.op !== "insertNode") {
      repaired.push(opInput as SceneOp);
      continue;
    }

    if (!op.node || typeof op.node !== "object") {
      return { ok: false, errors: [`Patch op ${index}: insertNode requires a node object.`] };
    }

    const node = structuredClone(op.node) as Record<string, unknown>;
    const assetId = typeof node.assetId === "string" ? node.assetId : null;
    const asset = assetId ? resolveEvalAsset(assetId, mediaAssets ?? []) : null;

    if (assetId && asset) {
      node.assetId = asset.sceneAssetId;

      if (!knownSceneAssets.has(asset.sceneAssetId)) {
        if (!emittedAssets.has(asset.sceneAssetId)) {
          repaired.push({
            op: "setAsset",
            asset: {
              id: asset.sceneAssetId,
              type: asset.type,
              src: asset.src,
            },
          });
          emittedAssets.add(asset.sceneAssetId);
        }

        knownSceneAssets.add(asset.sceneAssetId);
      }
    } else if (assetId && looksLikeUploadedMediaReference(assetId)) {
      return {
        ok: false,
        errors: [`Patch op ${index}: unresolved uploaded asset "${assetId}".`],
      };
    }

    repaired.push({
      op: "insertNode",
      node,
      ...(typeof op.parentId === "string" ? { parentId: op.parentId } : {}),
      ...(typeof op.beforeId === "string" ? { beforeId: op.beforeId } : {}),
    } as Extract<SceneOp, { op: "insertNode" }>);
  }

  return { ok: true, patch: repaired };
}

function resolveEvalAsset(
  input: string,
  assets: EvalMediaAsset[],
): EvalMediaAsset | null {
  const normalized = normalizeAssetAlias(input);

  return (
    assets.find((asset) =>
      [
        asset.id,
        asset.sceneAssetId,
        asset.label,
        asset.fileName,
        ...asset.aliases,
      ]
        .map(normalizeAssetAlias)
        .includes(normalized),
    ) ?? null
  );
}

function normalizeAssetAlias(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, " ");
}

function looksLikeUploadedMediaReference(value: string) {
  return /^(video|image|audio)[\s_-]?\d+$/i.test(value) || value.includes(".");
}
