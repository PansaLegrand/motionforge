import type { Scene, SceneNode, ScenePatch } from "@motionforge/schema";

export type SplitLayerPatchResult =
  | { ok: true; patch: ScenePatch; leftId: string; rightId: string }
  | { ok: false; error: string };

type IndexedNode = {
  node: SceneNode;
  parentId?: string;
  parentDuration: number;
};

export function createSplitLayerPatch({
  scene,
  nodeId,
  splitFrame,
}: {
  scene: Scene;
  nodeId: string;
  splitFrame: number;
}): SplitLayerPatchResult {
  const entry = findNode(scene.nodes, nodeId, scene.duration);

  if (!entry) {
    return { ok: false, error: `Select a layer that exists before splitting.` };
  }

  if ((entry.node.children ?? []).length > 0) {
    return {
      ok: false,
      error: "Split leaf layers only for now. Select a layer without children.",
    };
  }

  const nodeFrom = entry.node.from ?? 0;
  const nodeDuration = entry.node.duration ?? entry.parentDuration;
  const nodeEnd = nodeFrom + nodeDuration;

  if (!Number.isInteger(splitFrame)) {
    return { ok: false, error: "Split frame must be a whole frame number." };
  }

  if (splitFrame <= nodeFrom || splitFrame >= nodeEnd) {
    return {
      ok: false,
      error: "Move the playhead inside the selected layer before splitting.",
    };
  }

  const leftDuration = splitFrame - nodeFrom;
  const rightDuration = nodeEnd - splitFrame;
  const existingIds = collectNodeIds(scene.nodes);
  const leftId = uniqueSplitId(nodeId, "a", existingIds);
  existingIds.add(leftId);
  const rightId = uniqueSplitId(nodeId, "b", existingIds);
  const leftNode = {
    ...structuredClone(entry.node),
    id: leftId,
    from: nodeFrom,
    duration: leftDuration,
  };
  const rightNode = {
    ...structuredClone(entry.node),
    id: rightId,
    from: splitFrame,
    duration: rightDuration,
  };

  offsetMediaTrim(rightNode, leftDuration, scene.fps);

  return {
    ok: true,
    leftId,
    rightId,
    patch: [
      {
        op: "insertNode",
        node: leftNode,
        parentId: entry.parentId,
        beforeId: nodeId,
      },
      {
        op: "insertNode",
        node: rightNode,
        parentId: entry.parentId,
        beforeId: nodeId,
      },
      { op: "removeNode", id: nodeId },
    ],
  };
}

function findNode(
  nodes: SceneNode[],
  nodeId: string,
  parentDuration: number,
  parentId?: string,
): IndexedNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return { node, parentId, parentDuration };
    }

    const child = findNode(
      node.children ?? [],
      nodeId,
      node.duration ?? parentDuration,
      node.id,
    );

    if (child) {
      return child;
    }
  }

  return null;
}

function collectNodeIds(nodes: SceneNode[], into = new Set<string>()): Set<string> {
  for (const node of nodes) {
    into.add(node.id);
    collectNodeIds(node.children ?? [], into);
  }

  return into;
}

function uniqueSplitId(
  nodeId: string,
  suffix: string,
  existingIds: Set<string>,
): string {
  const base = `${nodeId}-${suffix}`;

  if (!existingIds.has(base)) {
    return base;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${base}-${index}`;

    if (!existingIds.has(candidate)) {
      return candidate;
    }
  }
}

function offsetMediaTrim(
  node: SceneNode,
  skippedFrames: number,
  fps: number,
): void {
  const skippedSeconds = skippedFrames / Math.max(1, fps);

  if (node.type === "video") {
    const rate = node.playbackRate ?? 1;
    node.videoStartTime = (node.videoStartTime ?? 0) + skippedSeconds * rate;
  }

  if (node.type === "audio") {
    node.audioStartTime = (node.audioStartTime ?? 0) + skippedSeconds;
  }
}
