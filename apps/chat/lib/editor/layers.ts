import type { Scene, SceneNode } from "@motionforge/schema";

export type EditorLayerBounds = {
  left?: number;
  top?: number;
  width?: number;
  height?: number;
};

export type EditorLayer = {
  id: string;
  type: SceneNode["type"];
  label: string;
  text?: string;
  color?: string;
  fontSize?: number | string;
  fontWeight?: number | string;
  textAlign?: "left" | "center" | "right";
  textStroke?: string;
  parentId?: string;
  depth: number;
  localFrom: number;
  localDuration: number;
  from: number;
  duration: number;
  end: number;
  zIndex: number;
  opacity?: number;
  paintIndex: number;
  childCount: number;
  bounds?: EditorLayerBounds;
};

type WalkContext = {
  parentId?: string;
  depth: number;
  parentAbsoluteFrom: number;
  parentAbsoluteEnd: number;
  parentLocalDuration: number;
  paintIndex: { current: number };
};

export function deriveEditorLayers(scene: Scene): EditorLayer[] {
  const layers: EditorLayer[] = [];
  const paintIndex = { current: 0 };

  for (const node of scene.nodes) {
    collectLayer(node, layers, {
      depth: 0,
      parentAbsoluteFrom: 0,
      parentAbsoluteEnd: scene.duration,
      parentLocalDuration: scene.duration,
      paintIndex,
    });
  }

  return layers;
}

export function findEditorLayer(
  layers: EditorLayer[],
  id: string | null,
): EditorLayer | null {
  if (!id) {
    return null;
  }

  return layers.find((layer) => layer.id === id) ?? null;
}

export function displayLayerType(type: SceneNode["type"]): string {
  switch (type) {
    case "img":
      return "image";
    default:
      return type;
  }
}

function collectLayer(
  node: SceneNode,
  layers: EditorLayer[],
  context: WalkContext,
): void {
  const localFrom = node.from ?? 0;
  const localDuration = node.duration ?? context.parentLocalDuration;
  const absoluteFrom = context.parentAbsoluteFrom + localFrom;
  const unclampedEnd = absoluteFrom + localDuration;
  const absoluteEnd = Math.max(
    absoluteFrom,
    Math.min(unclampedEnd, context.parentAbsoluteEnd),
  );

  layers.push({
    id: node.id,
    type: node.type,
    label: layerLabel(node),
    text: node.type === "text" ? node.text : undefined,
    color: typeof node.style?.color === "string" ? node.style.color : undefined,
    fontSize: node.style?.fontSize,
    fontWeight: node.style?.fontWeight,
    textAlign: node.style?.textAlign,
    textStroke:
      typeof node.style?.textStroke === "string"
        ? node.style.textStroke
        : undefined,
    parentId: context.parentId,
    depth: context.depth,
    localFrom,
    localDuration,
    from: absoluteFrom,
    duration: absoluteEnd - absoluteFrom,
    end: absoluteEnd,
    zIndex: typeof node.style?.zIndex === "number" ? node.style.zIndex : 0,
    opacity:
      typeof node.style?.opacity === "number" ? node.style.opacity : undefined,
    paintIndex: context.paintIndex.current,
    childCount: node.children?.length ?? 0,
    bounds: layerBounds(node),
  });
  context.paintIndex.current += 1;

  for (const child of node.children ?? []) {
    collectLayer(child, layers, {
      parentId: node.id,
      depth: context.depth + 1,
      parentAbsoluteFrom: absoluteFrom,
      parentAbsoluteEnd: absoluteEnd,
      parentLocalDuration: localDuration,
      paintIndex: context.paintIndex,
    });
  }
}

function layerLabel(node: SceneNode): string {
  if (node.type === "text") {
    const text = node.text?.replace(/\s+/g, " ").trim();

    if (text) {
      return truncate(text, 42);
    }
  }

  if (node.assetId) {
    return `${displayLayerType(node.type)} · ${node.assetId}`;
  }

  return node.id;
}

function layerBounds(node: SceneNode): EditorLayerBounds | undefined {
  const style = node.style;

  if (!style) {
    return undefined;
  }

  const bounds: EditorLayerBounds = {
    left: numericLength(style.left),
    top: numericLength(style.top),
    width: numericLength(style.width),
    height: numericLength(style.height),
  };

  return Object.values(bounds).some((value) => value !== undefined)
    ? bounds
    : undefined;
}

function numericLength(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  const px = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);

  if (px) {
    return Number.parseFloat(px[1] ?? "");
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number.parseFloat(trimmed);
  }

  return undefined;
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}
