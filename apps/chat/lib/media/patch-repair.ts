import type { Scene, SceneOp, ScenePatch } from "@motionforge/schema";
import type { ChatMediaAssetManifestItem } from "./assets";
import { resolveMediaAssetAlias } from "./mentions";

export type MediaPatchRepairResult =
  | { ok: true; patch: ScenePatch; diagnostics: string[] }
  | { ok: false; errors: string[] };

export function repairMediaPatch({
  scene,
  patchInput,
  mediaAssets,
}: {
  scene: Scene | null;
  patchInput: unknown;
  mediaAssets: ChatMediaAssetManifestItem[];
}): MediaPatchRepairResult {
  if (!Array.isArray(patchInput)) {
    return { ok: false, errors: ["Model patch must be an array of ops."] };
  }

  const diagnostics: string[] = [];
  const repaired: ScenePatch = [];
  const knownSceneAssets = new Set(Object.keys(scene?.assets ?? {}));
  const emittedAssets = new Set<string>();

  for (const [index, opInput] of patchInput.entries()) {
    if (!opInput || typeof opInput !== "object") {
      return { ok: false, errors: [`Patch op ${index} must be an object.`] };
    }

    const op = opInput as Record<string, unknown>;
    const opName = typeof op.op === "string" ? op.op : "";

    if (opName === "setAsset") {
      const assetResult = repairSetAssetOp(op, mediaAssets);

      if (!assetResult.ok) {
        return { ok: false, errors: [`Patch op ${index}: ${assetResult.error}`] };
      }

      diagnostics.push(...assetResult.diagnostics);
      repaired.push(assetResult.op);
      knownSceneAssets.add(assetResult.op.asset.id);
      emittedAssets.add(assetResult.op.asset.id);
      continue;
    }

    if (opName === "insertNode") {
      const nodeResult = repairInsertNodeOp(op, mediaAssets);

      if (!nodeResult.ok) {
        return { ok: false, errors: [`Patch op ${index}: ${nodeResult.error}`] };
      }

      const asset = nodeResult.asset;

      if (asset && !knownSceneAssets.has(asset.sceneAssetId)) {
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
          diagnostics.push(
            `Inserted missing setAsset for ${asset.label} before node ${nodeResult.op.node.id}.`,
          );
        }

        knownSceneAssets.add(asset.sceneAssetId);
      }

      diagnostics.push(...nodeResult.diagnostics);
      repaired.push(nodeResult.op);
      continue;
    }

    if (opName === "setNodeProps") {
      const propsResult = repairSetNodePropsOp(op, scene, mediaAssets);

      if (!propsResult.ok) {
        return { ok: false, errors: [`Patch op ${index}: ${propsResult.error}`] };
      }

      const asset = propsResult.asset;

      if (asset && !knownSceneAssets.has(asset.sceneAssetId)) {
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
          diagnostics.push(
            `Inserted missing setAsset for ${asset.label} before setNodeProps ${propsResult.op.id}.`,
          );
        }

        knownSceneAssets.add(asset.sceneAssetId);
      }

      diagnostics.push(...propsResult.diagnostics);
      repaired.push(propsResult.op);
      continue;
    }

    repaired.push(opInput as SceneOp);
  }

  return { ok: true, patch: repaired, diagnostics };
}

function repairSetAssetOp(
  op: Record<string, unknown>,
  mediaAssets: ChatMediaAssetManifestItem[],
):
  | { ok: true; op: Extract<SceneOp, { op: "setAsset" }>; diagnostics: string[] }
  | { ok: false; error: string } {
  if (!op.asset || typeof op.asset !== "object") {
    return { ok: false, error: "setAsset requires an asset object." };
  }

  const assetObject = op.asset as Record<string, unknown>;
  const requestedId = readString(assetObject.id);
  const mediaAsset = requestedId
    ? resolveMediaAssetAlias(requestedId, mediaAssets)
    : null;

  if (!mediaAsset) {
    return {
      ok: false,
      error: `setAsset references unknown uploaded asset "${requestedId ?? ""}".`,
    };
  }

  const diagnostics: string[] = [];

  if (requestedId !== mediaAsset.sceneAssetId) {
    diagnostics.push(
      `Repaired setAsset id "${requestedId}" to scene asset "${mediaAsset.sceneAssetId}".`,
    );
  }

  return {
    ok: true,
    op: {
      op: "setAsset",
      asset: {
        id: mediaAsset.sceneAssetId,
        type: mediaAsset.type,
        src: mediaAsset.src,
      },
    },
    diagnostics,
  };
}

function repairSetNodePropsOp(
  op: Record<string, unknown>,
  scene: Scene | null,
  mediaAssets: ChatMediaAssetManifestItem[],
):
  | {
      ok: true;
      op: Extract<SceneOp, { op: "setNodeProps" }>;
      asset: ChatMediaAssetManifestItem | null;
      diagnostics: string[];
    }
  | { ok: false; error: string } {
  const id = readString(op.id);

  if (!id) {
    return { ok: false, error: "setNodeProps requires a node id." };
  }

  if (!op.props || typeof op.props !== "object") {
    return { ok: false, error: "setNodeProps requires a props object." };
  }

  const props = structuredClone(op.props) as Record<string, unknown>;
  const requestedAssetId = readString(props.assetId);
  const mediaAsset = requestedAssetId
    ? resolveMediaAssetAlias(requestedAssetId, mediaAssets)
    : null;
  const currentNode = scene ? findNode(scene.nodes, id) : null;
  const diagnostics: string[] = [];

  if (requestedAssetId && mediaAsset) {
    if (
      currentNode &&
      mediaAsset.type === "audio" &&
      currentNode.type !== "audio"
    ) {
      return {
        ok: false,
        error: `setNodeProps cannot assign audio asset "${requestedAssetId}" to ${currentNode.type} node "${id}".`,
      };
    }

    if (
      currentNode &&
      mediaAsset.type !== "audio" &&
      currentNode.type === "audio"
    ) {
      return {
        ok: false,
        error: `setNodeProps cannot assign ${mediaAsset.type} asset "${requestedAssetId}" to audio node "${id}".`,
      };
    }

    if (requestedAssetId !== mediaAsset.sceneAssetId) {
      diagnostics.push(
        `Repaired setNodeProps assetId "${requestedAssetId}" to scene asset "${mediaAsset.sceneAssetId}".`,
      );
    }

    props.assetId = mediaAsset.sceneAssetId;
  } else if (requestedAssetId && looksLikeUploadedMediaReference(requestedAssetId)) {
    return {
      ok: false,
      error: `setNodeProps references unknown uploaded asset "${requestedAssetId}".`,
    };
  }

  return {
    ok: true,
    op: {
      op: "setNodeProps",
      id,
      props,
    } as Extract<SceneOp, { op: "setNodeProps" }>,
    asset: mediaAsset,
    diagnostics,
  };
}

function repairInsertNodeOp(
  op: Record<string, unknown>,
  mediaAssets: ChatMediaAssetManifestItem[],
):
  | {
      ok: true;
      op: Extract<SceneOp, { op: "insertNode" }>;
      asset: ChatMediaAssetManifestItem | null;
      diagnostics: string[];
    }
  | { ok: false; error: string } {
  if (!op.node || typeof op.node !== "object") {
    return { ok: false, error: "insertNode requires a node object." };
  }

  const node = structuredClone(op.node) as Record<string, unknown>;
  const diagnostics: string[] = [];
  const requestedAssetId = readString(node.assetId);
  const mediaAsset = requestedAssetId
    ? resolveMediaAssetAlias(requestedAssetId, mediaAssets)
    : null;

  if (requestedAssetId && mediaAsset) {
    if (requestedAssetId !== mediaAsset.sceneAssetId) {
      diagnostics.push(
        `Repaired node assetId "${requestedAssetId}" to scene asset "${mediaAsset.sceneAssetId}".`,
      );
    }

    node.assetId = mediaAsset.sceneAssetId;
  } else if (requestedAssetId && looksLikeUploadedMediaReference(requestedAssetId)) {
    return {
      ok: false,
      error: `insertNode references unknown uploaded asset "${requestedAssetId}".`,
    };
  }

  const repairedOp = {
    op: "insertNode",
    node,
    ...(typeof op.parentId === "string" ? { parentId: op.parentId } : {}),
    ...(typeof op.beforeId === "string" ? { beforeId: op.beforeId } : {}),
  };

  return {
    ok: true,
    op: repairedOp as Extract<SceneOp, { op: "insertNode" }>,
    asset: mediaAsset,
    diagnostics,
  };
}

function looksLikeUploadedMediaReference(value: string) {
  return /^(video|image|audio)[\s_-]?\d+$/i.test(value) || value.includes(".");
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function findNode(nodes: Scene["nodes"], id: string): Scene["nodes"][number] | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const child = findNode(node.children ?? [], id);

    if (child) {
      return child;
    }
  }

  return null;
}
