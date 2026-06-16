import type { EditorLayer } from "./layers";

export type PreviewCanvasRect = {
  width: number;
  height: number;
};

export type PreviewSelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PreviewSelectionOverlay =
  | {
      kind: "bounds";
      rect: PreviewSelectionRect;
      label: string;
      visible: boolean;
    }
  | {
      kind: "unbounded";
      label: string;
      visible: boolean;
    };

export function createPreviewSelectionOverlay({
  layer,
  sceneWidth,
  sceneHeight,
  canvasRect,
  frame,
}: {
  layer: EditorLayer | null;
  sceneWidth: number;
  sceneHeight: number;
  canvasRect: PreviewCanvasRect;
  frame: number;
}): PreviewSelectionOverlay | null {
  if (!layer) {
    return null;
  }

  const visible = frame >= layer.from && frame < layer.end;
  const label = `${layer.label} · ${layer.type}`;

  if (!layer.bounds || sceneWidth <= 0 || sceneHeight <= 0) {
    return { kind: "unbounded", label, visible };
  }

  const scaleX = canvasRect.width / sceneWidth;
  const scaleY = canvasRect.height / sceneHeight;
  const left = (layer.bounds.left ?? 0) * scaleX;
  const top = (layer.bounds.top ?? 0) * scaleY;
  const width = Math.max(1, (layer.bounds.width ?? sceneWidth) * scaleX);
  const height = Math.max(1, (layer.bounds.height ?? sceneHeight) * scaleY);

  return {
    kind: "bounds",
    label,
    visible,
    rect: { left, top, width, height },
  };
}
