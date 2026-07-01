import {
  isFilterExpression,
  supportedStyleKeys,
  type Scene,
  type SceneOp,
  type ScenePatch,
} from "@motionforge/schema";
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

    if (!supportedPatchOps.has(opName)) {
      diagnostics.push(`Dropped unsupported patch op ${index} "${opName || "(missing)"}".`);
      continue;
    }

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
          const targetId =
            propsResult.ops.find((candidate) => "id" in candidate)?.id ??
            "(unknown)";
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
            `Inserted missing setAsset for ${asset.label} before setNodeProps ${targetId}.`,
          );
        }

        knownSceneAssets.add(asset.sceneAssetId);
      }

      diagnostics.push(...propsResult.diagnostics);
      repaired.push(...propsResult.ops);
      continue;
    }

    if (opName === "setStyle") {
      const styleResult = repairSetStyleOp(op, index);

      diagnostics.push(...styleResult.diagnostics);

      if (styleResult.op) {
        repaired.push(styleResult.op);
      }
      continue;
    }

    if (opName === "setText") {
      const textResult = repairSetTextOp(op, index);

      diagnostics.push(...textResult.diagnostics);

      if (textResult.op) {
        repaired.push(textResult.op);
      }
      continue;
    }

    if (opName === "retime") {
      const retimeResult = repairRetimeOp(op, index);

      diagnostics.push(...retimeResult.diagnostics);

      if (retimeResult.op) {
        repaired.push(retimeResult.op);
      }
      continue;
    }

    const idResult = repairIdOnlyOp(op, index);

    diagnostics.push(...idResult.diagnostics);

    if (idResult.op) {
      repaired.push(idResult.op);
    }
  }

  if (repaired.length === 0 && patchInput.length > 0) {
    return {
      ok: false,
      errors: [
        `All ${patchInput.length} model patch ops were dropped during repair. ${diagnostics.join(" ")}`.trim(),
      ],
    };
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
      ops: ScenePatch;
      asset: ChatMediaAssetManifestItem | null;
      diagnostics: string[];
    }
  | { ok: false; error: string } {
  const id = readPatchTargetId(op);

  if (!id) {
    return {
      ok: true,
      ops: [],
      asset: null,
      diagnostics: ["Dropped setNodeProps op because it has no node id."],
    };
  }

  if (!op.props || typeof op.props !== "object") {
    return {
      ok: true,
      ops: [],
      asset: null,
      diagnostics: [`Dropped setNodeProps "${id}" because it has no props object.`],
    };
  }

  const props = structuredClone(op.props) as Record<string, unknown>;
  const ops: ScenePatch = [];
  const requestedAssetId = readString(props.assetId);
  const mediaAsset = requestedAssetId
    ? resolveMediaAssetAlias(requestedAssetId, mediaAssets)
    : null;
  const currentNode = scene ? findNode(scene.nodes, id) : null;
  const diagnostics: string[] = [];
  const timing = readRetimeFields({ ...op, ...props });

  if (timing.from !== undefined || timing.duration !== undefined) {
    ops.push({ op: "retime", id, ...timing });
    diagnostics.push(`Converted setNodeProps timing for "${id}" to retime.`);
  }

  delete props.from;
  delete props.duration;

  const text = readString(props.text);

  if (text) {
    ops.push({ op: "setText", id, text });
    diagnostics.push(`Converted setNodeProps text for "${id}" to setText.`);
  }

  delete props.text;

  if (isRecord(props.style)) {
    const style = filterSupportedStyle(props.style);

    if (Object.keys(style).length > 0) {
      ops.push({ op: "setStyle", id, style });
      diagnostics.push(`Converted setNodeProps style for "${id}" to setStyle.`);
    }
  }

  delete props.style;

  if (Array.isArray(props.animations)) {
    ops.push({
      op: "setAnimations",
      id,
      animations: props.animations,
    } as Extract<SceneOp, { op: "setAnimations" }>);
    diagnostics.push(
      `Converted setNodeProps animations for "${id}" to setAnimations.`,
    );
  }

  delete props.animations;

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

  const supportedProps = filterSupportedNodeProps(props);

  if (Object.keys(supportedProps).length > 0) {
    ops.push({
      op: "setNodeProps",
      id,
      props: supportedProps,
    } as Extract<SceneOp, { op: "setNodeProps" }>);
  } else if (ops.length === 0) {
    diagnostics.push(
      `Dropped setNodeProps "${id}" because it only contained unsupported props.`,
    );
  }

  return {
    ok: true,
    ops,
    asset: mediaAsset,
    diagnostics,
  };
}

function repairSetStyleOp(
  op: Record<string, unknown>,
  index: number,
): {
  op: Extract<SceneOp, { op: "setStyle" }> | null;
  diagnostics: string[];
} {
  const id = readPatchTargetId(op);

  if (!id) {
    return {
      op: null,
      diagnostics: [`Dropped setStyle op ${index} because it has no node id.`],
    };
  }

  if (!isRecord(op.style)) {
    return {
      op: null,
      diagnostics: [`Dropped setStyle "${id}" because it has no style object.`],
    };
  }

  const style = filterSupportedStyle(op.style);

  if (Object.keys(style).length === 0) {
    return {
      op: null,
      diagnostics: [`Dropped setStyle "${id}" because no supported style keys remained.`],
    };
  }

  return {
    op: { op: "setStyle", id, style },
    diagnostics:
      id === op.id ? [] : [`Repaired setStyle target id for op ${index} to "${id}".`],
  };
}

function repairSetTextOp(
  op: Record<string, unknown>,
  index: number,
): {
  op: Extract<SceneOp, { op: "setText" }> | null;
  diagnostics: string[];
} {
  const id = readPatchTargetId(op);

  if (!id) {
    return {
      op: null,
      diagnostics: [`Dropped setText op ${index} because it has no node id.`],
    };
  }

  const text = readString(op.text ?? op.value ?? op.content);

  if (!text) {
    return {
      op: null,
      diagnostics: [`Dropped setText "${id}" because it has no text.`],
    };
  }

  return {
    op: { op: "setText", id, text },
    diagnostics:
      id === op.id ? [] : [`Repaired setText target id for op ${index} to "${id}".`],
  };
}

function repairRetimeOp(
  op: Record<string, unknown>,
  index: number,
): {
  op: Extract<SceneOp, { op: "retime" }> | null;
  diagnostics: string[];
} {
  const id = readPatchTargetId(op);

  if (!id) {
    return {
      op: null,
      diagnostics: [`Dropped retime op ${index} because it has no node id.`],
    };
  }

  const timing = readRetimeFields(op);

  if (timing.from === undefined && timing.duration === undefined) {
    return {
      op: null,
      diagnostics: [`Dropped retime "${id}" because it has no timing fields.`],
    };
  }

  return {
    op: { op: "retime", id, ...timing },
    diagnostics:
      id === op.id ? [] : [`Repaired retime target id for op ${index} to "${id}".`],
  };
}

function repairIdOnlyOp(
  op: Record<string, unknown>,
  index: number,
): { op: SceneOp | null; diagnostics: string[] } {
  if (!idPatchOps.has(String(op.op))) {
    return { op: op as SceneOp, diagnostics: [] };
  }

  const id = readPatchTargetId(op);

  if (!id) {
    return {
      op: null,
      diagnostics: [`Dropped ${String(op.op)} op ${index} because it has no node id.`],
    };
  }

  return {
    op: { ...op, id } as SceneOp,
    diagnostics:
      id === op.id
        ? []
        : [`Repaired ${String(op.op)} target id for op ${index} to "${id}".`],
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

const supportedPatchOps = new Set([
  "setStyle",
  "setText",
  "setNodeProps",
  "retime",
  "setAnimations",
  "insertNode",
  "removeNode",
  "moveNode",
  "setAsset",
  "removeAsset",
  "setSceneMeta",
]);

const idPatchOps = new Set([
  "setAnimations",
  "removeNode",
  "moveNode",
  "removeAsset",
]);

const supportedNodePropKeys = new Set([
  "assetId",
  "videoStartTime",
  "playbackRate",
  "audioStartTime",
  "volume",
  "volumeEnvelope",
  "loop",
]);

const supportedStyleKeySet = new Set<string>(supportedStyleKeys);

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readPatchTargetId(op: Record<string, unknown>) {
  return readString(op.id) ?? readString(op.nodeId) ?? readString(op.targetId);
}

function readRetimeFields(input: Record<string, unknown>) {
  const from = readInteger(input.from);
  const duration = readPositiveInteger(input.duration);

  return {
    ...(from === null ? {} : { from }),
    ...(duration === null ? {} : { duration }),
  };
}

function readInteger(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}

function readPositiveInteger(value: unknown) {
  const parsed = readInteger(value);
  return parsed !== null && parsed > 0 ? parsed : null;
}

function filterSupportedNodeProps(props: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => supportedNodePropKeys.has(key)),
  );
}

function filterSupportedStyle(style: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(style)
      .filter(([key]) => supportedStyleKeySet.has(key))
      .map(([key, value]) => [key, normalizeStyleValue(key, value)])
      .filter((entry): entry is [string, unknown] => entry[1] !== undefined),
  );
}

function normalizeStyleValue(key: string, value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim();

  switch (key) {
    case "filter":
      return isFilterExpression(normalized) ? normalized : undefined;
    case "background":
      return isUnsupportedGradient(normalized) ? undefined : value;
    case "alignItems":
      return normalizeEnumValue(normalized, {
        start: "flex-start",
        end: "flex-end",
        baseline: "center",
        "first baseline": "center",
        "last baseline": "center",
      });
    case "justifyContent":
      return normalizeEnumValue(normalized, {
        start: "flex-start",
        end: "flex-end",
        "space-around": "space-between",
        "space-evenly": "space-between",
      });
    case "flexDirection":
      return normalizeEnumValue(normalized, {
        "row-reverse": "row",
        "column-reverse": "column",
      });
    case "position":
      return normalizeEnumValue(normalized, {
        fixed: "absolute",
        sticky: "absolute",
        static: "relative",
      });
    case "overflow":
      return normalizeEnumValue(normalized, {
        auto: "hidden",
        scroll: "hidden",
        clip: "hidden",
      });
    case "textAlign":
      return normalizeEnumValue(normalized, {
        start: "left",
        end: "right",
        justify: "center",
      });
    case "fontStyle":
      return normalizeEnumValue(normalized, {
        oblique: "italic",
      });
    default:
      return value;
  }
}

function normalizeEnumValue(value: string, aliases: Record<string, string>) {
  return aliases[value] ?? value;
}

function isUnsupportedGradient(value: string): boolean {
  return /(?:^|[\s,])(?:radial|conic|repeating-linear|repeating-radial)-gradient\(/i.test(
    value,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
