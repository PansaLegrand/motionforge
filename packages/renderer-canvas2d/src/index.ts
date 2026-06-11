import { evaluateScene, layoutScene, type LayoutBox } from "@motionforge/core";
import { parseScene, type Scene, type SceneStyle } from "@motionforge/schema";

export type RenderOptions = {
  clear?: boolean;
  /** Result of resolveAssets(). Required when the scene draws img nodes. */
  assets?: ResolvedAssets;
};

/**
 * Decoded media for a scene, produced by resolveAssets(). Asset loading is
 * the only async phase: given the same scene, frame, and resolved assets,
 * rendering is pure and deterministic.
 */
export type ResolvedAssets = {
  images: Map<string, ImageBitmap>;
};

/**
 * Fetches and decodes every asset the scene references. Call once per scene
 * (or whenever scene.assets changes) and pass the result to renderStill via
 * options.assets. Throws with the failing asset id and src on any failure;
 * a scene never renders with silently missing media.
 */
export async function resolveAssets(scene: Scene): Promise<ResolvedAssets> {
  const parsed = parseScene(scene);
  const images = new Map<string, ImageBitmap>();

  await Promise.all(
    Object.values(parsed.assets).map(async (asset) => {
      if (asset.type !== "image") {
        return;
      }

      try {
        const response = await fetch(asset.src);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        images.set(asset.id, await decodeImageBlob(await response.blob()));
      } catch (cause) {
        throw new Error(
          `Failed to load image asset "${asset.id}" from ${truncateSrc(asset.src)}: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
    }),
  );

  return { images };
}

function truncateSrc(src: string): string {
  return src.length > 96 ? `${src.slice(0, 96)}…` : src;
}

/**
 * createImageBitmap(blob) cannot decode SVG in Chromium; fall back to an
 * HTMLImageElement (already rasterized at its intrinsic size) when available.
 */
async function decodeImageBlob(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    if (typeof document === "undefined") {
      throw error;
    }

    const url = URL.createObjectURL(blob);

    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return await createImageBitmap(image);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export function renderStill(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  scene: Scene,
  frame: number,
  options: RenderOptions = {},
): void {
  const resolved = evaluateScene(scene, frame);
  const layout = layoutScene(resolved);

  if (options.clear ?? true) {
    context.clearRect(0, 0, scene.width, scene.height);
  }

  for (const box of layout.boxes) {
    drawBox(context, box, options.assets);
  }
}

function drawBox(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  assets: ResolvedAssets | undefined,
): void {
  const { node } = box;
  const style = node.style;

  context.save();
  context.globalAlpha *= style.opacity ?? 1;
  applyTransform(context, box, style);

  drawBackground(context, box, style);

  if (node.type === "text" && node.text) {
    drawText(context, box, node.text, style);
  }

  if (node.type === "img" && node.assetId) {
    drawImage(context, box, node.assetId, style, assets);
  }

  for (const child of box.children) {
    drawBox(context, child, assets);
  }

  context.restore();
}

/**
 * Geometry for drawing media into a box under objectFit/objectPosition.
 * Exported for tests; coordinates are relative to the box origin.
 */
export function computeObjectFit(
  fit: SceneStyle["objectFit"],
  position: string | undefined,
  box: { width: number; height: number },
  natural: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const containScale =
    natural.width > 0 && natural.height > 0
      ? Math.min(box.width / natural.width, box.height / natural.height)
      : 1;
  const coverScale =
    natural.width > 0 && natural.height > 0
      ? Math.max(box.width / natural.width, box.height / natural.height)
      : 1;

  let width = box.width;
  let height = box.height;

  switch (fit ?? "fill") {
    case "contain":
      width = natural.width * containScale;
      height = natural.height * containScale;
      break;
    case "cover":
      width = natural.width * coverScale;
      height = natural.height * coverScale;
      break;
    case "none":
      width = natural.width;
      height = natural.height;
      break;
    case "scale-down": {
      const scale = Math.min(1, containScale);
      width = natural.width * scale;
      height = natural.height * scale;
      break;
    }
    case "fill":
    default:
      break;
  }

  const parts = (position ?? "").trim().split(/\s+/).filter(Boolean);
  const xPart = parts[0] ?? "center";
  const yPart = parts[1] ?? "center";

  return {
    x: resolvePositionComponent(xPart, box.width, width),
    y: resolvePositionComponent(yPart, box.height, height),
    width,
    height,
  };
}

function resolvePositionComponent(
  part: string,
  boxSize: number,
  drawnSize: number,
): number {
  if (part === "left" || part === "top") {
    return 0;
  }

  if (part === "right" || part === "bottom") {
    return boxSize - drawnSize;
  }

  if (part === "center") {
    return (boxSize - drawnSize) / 2;
  }

  // CSS: percentages align the image's X% point with the box's X% point;
  // px values offset the image's edge from the box's edge.
  if (part.endsWith("%")) {
    const fraction = Number.parseFloat(part) / 100;
    return Number.isFinite(fraction) ? (boxSize - drawnSize) * fraction : 0;
  }

  const px = Number.parseFloat(part);
  return Number.isFinite(px) ? px : (boxSize - drawnSize) / 2;
}

function drawImage(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  assetId: string,
  style: SceneStyle,
  assets: ResolvedAssets | undefined,
): void {
  const image = assets?.images.get(assetId);

  if (!image) {
    throw new Error(
      `Scene draws image asset "${assetId}" but it is not in the resolved assets. Call resolveAssets(scene) and pass the result to renderStill via options.assets.`,
    );
  }

  const fitted = computeObjectFit(
    style.objectFit,
    style.objectPosition,
    box,
    image,
  );

  context.save();
  // Explicit smoothing settings so scaled pixels are deliberate, not
  // browser-default-dependent.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  const radius = readLength(
    style.borderRadius,
    Math.min(box.width, box.height),
    0,
  );

  if (radius > 0) {
    roundedRect(context, box.x, box.y, box.width, box.height, radius);
  } else {
    context.beginPath();
    context.rect(box.x, box.y, box.width, box.height);
  }

  context.clip();
  context.drawImage(
    image,
    box.x + fitted.x,
    box.y + fitted.y,
    fitted.width,
    fitted.height,
  );
  context.restore();
}

function drawBackground(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
): void {
  const background = style.background ?? style.backgroundColor;

  if (!background) {
    return;
  }

  context.fillStyle = parseFill(context, box, background);
  const radius = readLength(
    style.borderRadius,
    Math.min(box.width, box.height),
    0,
  );

  if (radius > 0) {
    roundedRect(context, box.x, box.y, box.width, box.height, radius);
    context.fill();
    return;
  }

  context.fillRect(box.x, box.y, box.width, box.height);
}

/**
 * Splits text into rendered lines: explicit "\n" always breaks, and words
 * wrap when a line would exceed maxWidth. A single word wider than maxWidth
 * gets its own line and is clamped by fillText's maxWidth at draw time.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  measure: (line: string) => number,
): string[] {
  const lines: string[] = [];

  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter((word) => word.length > 0);

    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let current = "";

    for (const word of words) {
      const candidate = current === "" ? word : `${current} ${word}`;

      if (current !== "" && measure(candidate) > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }

    lines.push(current);
  }

  return lines;
}

function resolveLineHeight(
  value: number | string | undefined,
  fontSize: number,
): number {
  // CSS semantics: a unitless number is a multiplier of the font size.
  if (typeof value === "number") {
    return fontSize * value;
  }

  return readLength(value, fontSize, fontSize * 1.25);
}

function drawText(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  value: string,
  style: SceneStyle,
): void {
  const fontSize = readLength(style.fontSize, box.height, 24);
  const fontFamily = style.fontFamily ?? "system-ui, sans-serif";
  const fontWeight = style.fontWeight ?? 400;
  const fontStyle = style.fontStyle ?? "normal";
  context.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  context.fillStyle = style.color ?? "#ffffff";
  context.textAlign = style.textAlign ?? "left";
  context.textBaseline = "middle";

  const letterSpacing = readLength(style.letterSpacing, fontSize, 0);
  if (letterSpacing !== 0 && "letterSpacing" in context) {
    context.letterSpacing = `${letterSpacing}px`;
  }

  const shadow = parseTextShadow(style.textShadow);
  if (shadow) {
    context.shadowOffsetX = shadow.x;
    context.shadowOffsetY = shadow.y;
    context.shadowBlur = shadow.blur;
    context.shadowColor = shadow.color;
  }

  const x =
    style.textAlign === "center"
      ? box.x + box.width / 2
      : style.textAlign === "right"
        ? box.x + box.width
        : box.x;

  const lineHeight = resolveLineHeight(style.lineHeight, fontSize);
  const lines = wrapTextLines(
    value,
    box.width,
    (line) => context.measureText(line).width,
  );
  // The line block is centered vertically in the box, matching the previous
  // single-line behavior when there is exactly one line.
  const firstLineY =
    box.y + box.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    if (line !== "") {
      context.fillText(line, x, firstLineY + index * lineHeight, box.width);
    }
  });
}

function resolveTransformOrigin(
  value: string | undefined,
  box: LayoutBox,
): { x: number; y: number } {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  const xPart = parts[0] ?? "center";
  const yPart = parts[1] ?? "center";

  return {
    x: box.x + resolveOriginComponent(xPart, box.width),
    y: box.y + resolveOriginComponent(yPart, box.height),
  };
}

function resolveOriginComponent(part: string, size: number): number {
  if (part === "left" || part === "top") {
    return 0;
  }

  if (part === "right" || part === "bottom") {
    return size;
  }

  if (part === "center") {
    return size / 2;
  }

  return readLength(part, size, size / 2);
}

function applyTransform(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
): void {
  if (!style.transform) {
    return;
  }

  const origin = resolveTransformOrigin(style.transformOrigin, box);
  context.translate(origin.x, origin.y);

  for (const part of style.transform.matchAll(
    /(translate|scale|rotate)\(([^)]+)\)/g,
  )) {
    const fn = part[1];
    const args = part[2]?.split(",").map((arg) => arg.trim()) ?? [];

    if (fn === "translate") {
      context.translate(
        readLength(args[0], box.width, 0),
        readLength(args[1], box.height, 0),
      );
    }

    if (fn === "scale") {
      const sx = Number.parseFloat(args[0] ?? "1");
      const sy = args[1] === undefined ? sx : Number.parseFloat(args[1]);
      context.scale(sx, sy);
    }

    if (fn === "rotate") {
      const degrees = Number.parseFloat(args[0] ?? "0");
      context.rotate((degrees * Math.PI) / 180);
    }
  }

  context.translate(-origin.x, -origin.y);
}

function parseFill(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  value: string,
): string | CanvasGradient {
  const linear = value.match(
    /^linear-gradient\((.+),\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+\d+%,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+\d+%\)$/,
  );

  if (!linear) {
    return value;
  }

  const angle = linear[1] ?? "180deg";
  const first = linear[2] ?? "#000";
  const second = linear[3] ?? "#fff";
  const vertical = angle.includes("180deg") || angle.includes("to bottom");
  const gradient = vertical
    ? context.createLinearGradient(box.x, box.y, box.x, box.y + box.height)
    : context.createLinearGradient(box.x, box.y, box.x + box.width, box.y);

  gradient.addColorStop(0, first);
  gradient.addColorStop(1, second);
  return gradient;
}

function parseTextShadow(
  value: string | undefined,
): { x: number; y: number; blur: number; color: string } | null {
  if (!value) {
    return null;
  }

  const match = value.match(
    /^(-?\d+(?:\.\d+)?)px?\s+(-?\d+(?:\.\d+)?)px?\s+(\d+(?:\.\d+)?)px?\s+(.+)$/,
  );

  if (!match) {
    return null;
  }

  return {
    x: Number.parseFloat(match[1] ?? "0"),
    y: Number.parseFloat(match[2] ?? "0"),
    blur: Number.parseFloat(match[3] ?? "0"),
    color: match[4] ?? "rgba(0,0,0,0.4)",
  };
}

function roundedRect(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function readLength(
  value: string | number | undefined,
  parent: number,
  fallback: number,
): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value !== "string") {
    return fallback;
  }

  if (value.endsWith("%")) {
    return (Number.parseFloat(value) / 100) * parent;
  }

  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
