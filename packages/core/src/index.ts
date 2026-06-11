import {
  type Scene,
  type SceneAnimation,
  type SceneAsset,
  type SceneNode,
  type SceneStyle,
  parseScene,
} from "@motionforge/schema";

export type CompositionOptions = {
  width: number;
  height: number;
  fps: number;
  duration: number;
};

export type NodeOptions = {
  id?: string;
  from?: number;
  duration?: number;
  style?: SceneStyle;
  assetId?: string;
};

type IdCounter = { next: number };

export class SceneBuilder {
  private readonly options: CompositionOptions;
  private readonly assets: Record<string, SceneAsset> = {};
  private readonly childBuilders: NodeBuilder[] = [];

  constructor(options: CompositionOptions) {
    this.options = options;
  }

  asset(asset: SceneAsset): this {
    this.assets[asset.id] = asset;
    return this;
  }

  children(...nodes: NodeBuilder[]): this {
    this.childBuilders.push(...nodes);
    return this;
  }

  toJSON(): Scene {
    const counter: IdCounter = { next: 0 };

    return parseScene({
      schemaVersion: 0,
      width: this.options.width,
      height: this.options.height,
      fps: this.options.fps,
      duration: this.options.duration,
      assets: structuredClone(this.assets),
      nodes: this.childBuilders.map((node) => node.build(counter)),
    });
  }
}

export class NodeBuilder {
  private readonly type: SceneNode["type"];
  private readonly id?: string;
  private readonly text?: string;
  private readonly assetId?: string;
  private from: number;
  private duration?: number;
  private readonly style: SceneStyle;
  private readonly animations: SceneAnimation[] = [];
  private readonly childBuilders: NodeBuilder[] = [];

  constructor(
    type: SceneNode["type"],
    options: NodeOptions & { text?: string } = {},
  ) {
    this.type = type;
    this.id = options.id;
    this.text = options.text;
    this.assetId = options.assetId;
    this.from = options.from ?? 0;
    this.duration = options.duration;
    this.style = options.style ?? {};
  }

  children(...nodes: NodeBuilder[]): this {
    this.childBuilders.push(...nodes);
    return this;
  }

  at(from: number, duration?: number): this {
    this.from = from;
    this.duration = duration;
    return this;
  }

  animate(
    property: keyof SceneStyle | string,
    frames: SceneAnimation["frames"],
  ): this {
    this.animations.push({
      kind: "keyframes",
      property: String(property),
      frames,
    });
    return this;
  }

  toJSON(): SceneNode {
    return this.build({ next: 0 });
  }

  /**
   * Serializes the builder tree. Auto ids are assigned in document order from
   * the shared counter, so the same builder program always emits the same JSON.
   */
  build(counter: IdCounter): SceneNode {
    return structuredClone({
      id: this.id ?? `${this.type}-${counter.next++}`,
      type: this.type,
      text: this.text,
      assetId: this.assetId,
      from: this.from,
      duration: this.duration,
      style: this.style,
      animations: this.animations,
      children: this.childBuilders.map((child) => child.build(counter)),
    });
  }
}

export function composition(options: CompositionOptions): SceneBuilder {
  return new SceneBuilder(options);
}

export function div(options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("div", options);
}

export function text(value: string, options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("text", { ...options, text: value });
}

export function img(assetId: string, options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("img", { ...options, assetId });
}

export function video(assetId: string, options: NodeOptions = {}): NodeBuilder {
  return new NodeBuilder("video", { ...options, assetId });
}

export type ResolvedNode = Omit<SceneNode, "children"> & {
  style: SceneStyle;
  children: ResolvedNode[];
};

export type ResolvedScene = Omit<Scene, "nodes"> & {
  frame: number;
  nodes: ResolvedNode[];
};

export function evaluateScene(sceneInput: Scene, frame: number): ResolvedScene {
  const scene = parseScene(sceneInput);
  const clampedFrame = Math.max(0, Math.min(frame, scene.duration - 1));

  return {
    ...scene,
    frame: clampedFrame,
    nodes: scene.nodes.flatMap((node) =>
      evaluateNode(node, clampedFrame, scene.duration),
    ),
  };
}

function evaluateNode(
  node: SceneNode,
  absoluteFrame: number,
  parentDuration: number,
): ResolvedNode[] {
  const from = node.from ?? 0;
  const duration = node.duration ?? parentDuration;
  const localFrame = absoluteFrame - from;

  if (localFrame < 0 || localFrame >= duration) {
    return [];
  }

  const style = { ...(node.style ?? {}) };

  for (const animation of node.animations ?? []) {
    if (animation.kind === "keyframes") {
      const value = evaluateKeyframes(animation.frames, localFrame);
      if (value !== undefined) {
        (style as Record<string, unknown>)[animation.property] = value;
      }
    }
  }

  const children = (node.children ?? []).flatMap((child) =>
    evaluateNode(child, localFrame, duration),
  );

  return [
    {
      ...node,
      style,
      children,
    },
  ];
}

/**
 * Resolves an animated value at a node-local frame. Frames must be in strictly
 * increasing order (the schema enforces this). Numeric values interpolate;
 * string values interpolate in RGBA space when both parse as colors and step
 * otherwise.
 */
export function evaluateKeyframes(
  frames: SceneAnimation["frames"],
  frame: number,
): string | number | undefined {
  const first = frames[0];
  const last = frames[frames.length - 1];

  if (!first || !last) {
    return undefined;
  }

  if (frame <= first.frame) {
    return first.value;
  }

  if (frame >= last.frame) {
    return last.value;
  }

  const nextIndex = frames.findIndex((entry) => entry.frame >= frame);
  const next = frames[nextIndex];
  const prev = frames[nextIndex - 1];

  if (!prev || !next) {
    return last.value;
  }

  const span = next.frame - prev.frame;
  const rawT = span === 0 ? 1 : (frame - prev.frame) / span;
  const t = applyEasing(rawT, next.easing ?? "linear");

  if (typeof prev.value === "number" && typeof next.value === "number") {
    return prev.value + (next.value - prev.value) * t;
  }

  if (typeof prev.value === "string" && typeof next.value === "string") {
    const from = parseColor(prev.value);
    const to = parseColor(next.value);

    if (from && to) {
      return mixColors(from, to, t);
    }
  }

  // Non-interpolatable values step at the next keyframe.
  return frame < next.frame ? prev.value : next.value;
}

export type RgbaColor = { r: number; g: number; b: number; a: number };

/**
 * Parses #rgb/#rgba/#rrggbb/#rrggbbaa hex and rgb()/rgba() color strings.
 * Returns null for anything else (named colors, gradients, hsl, ...), which
 * makes the value step instead of interpolate.
 */
export function parseColor(value: string): RgbaColor | null {
  const trimmed = value.trim();
  const hex = trimmed.match(/^#([0-9a-fA-F]+)$/);

  if (hex) {
    const digits = hex[1] ?? "";

    if (digits.length === 3 || digits.length === 4) {
      const channels = digits
        .split("")
        .map((digit) => Number.parseInt(digit + digit, 16));
      const [r, g, b, a] = channels;
      return {
        r: r ?? 0,
        g: g ?? 0,
        b: b ?? 0,
        a: digits.length === 4 ? (a ?? 255) / 255 : 1,
      };
    }

    if (digits.length === 6 || digits.length === 8) {
      return {
        r: Number.parseInt(digits.slice(0, 2), 16),
        g: Number.parseInt(digits.slice(2, 4), 16),
        b: Number.parseInt(digits.slice(4, 6), 16),
        a:
          digits.length === 8
            ? Number.parseInt(digits.slice(6, 8), 16) / 255
            : 1,
      };
    }

    return null;
  }

  const fn = trimmed.match(/^rgba?\(([^)]+)\)$/);

  if (!fn) {
    return null;
  }

  const parts = (fn[1] ?? "").split(",").map((part) => part.trim());

  if (parts.length !== 3 && parts.length !== 4) {
    return null;
  }

  const r = Number.parseFloat(parts[0] ?? "");
  const g = Number.parseFloat(parts[1] ?? "");
  const b = Number.parseFloat(parts[2] ?? "");
  const a = parts.length === 4 ? Number.parseFloat(parts[3] ?? "") : 1;

  if (![r, g, b, a].every(Number.isFinite)) {
    return null;
  }

  return { r, g, b, a };
}

function mixColors(from: RgbaColor, to: RgbaColor, t: number): string {
  const channel = (start: number, end: number): number =>
    Math.round(Math.min(255, Math.max(0, start + (end - start) * t)));
  const alpha = Math.min(1, Math.max(0, from.a + (to.a - from.a) * t));

  return `rgba(${channel(from.r, to.r)}, ${channel(from.g, to.g)}, ${channel(from.b, to.b)}, ${Number(alpha.toFixed(4))})`;
}

export function applyEasing(
  t: number,
  easing: "linear" | "easeIn" | "easeOut" | "easeInOut",
): number {
  switch (easing) {
    case "easeIn":
      return t * t;
    case "easeOut":
      return 1 - (1 - t) * (1 - t);
    case "easeInOut":
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    case "linear":
    default:
      return t;
  }
}

export type LayoutBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  node: ResolvedNode;
  children: LayoutBox[];
};

export type LayoutScene = Omit<ResolvedScene, "nodes"> & {
  boxes: LayoutBox[];
};

export function layoutScene(scene: ResolvedScene): LayoutScene {
  const root = { x: 0, y: 0, width: scene.width, height: scene.height };

  return {
    ...scene,
    boxes: scene.nodes.map((node) => layoutNode(node, root)),
  };
}

function layoutNode(
  node: ResolvedNode,
  containingBlock: { x: number; y: number; width: number; height: number },
): LayoutBox {
  const style = node.style ?? {};
  const inset = readLength(style.inset, containingBlock.width, 0);
  // A single margin value adds outer spacing on all sides: it shifts the box
  // away from its anchor edge and shrinks auto-sized dimensions.
  const margin = readLength(style.margin, containingBlock.width, 0);
  const left = readLength(style.left, containingBlock.width, inset);
  const top = readLength(style.top, containingBlock.height, inset);
  const right =
    style.right === undefined
      ? undefined
      : readLength(style.right, containingBlock.width, 0);
  const bottom =
    style.bottom === undefined
      ? undefined
      : readLength(style.bottom, containingBlock.height, 0);
  const widthFallback =
    (style.position === "absolute" &&
    right !== undefined &&
    style.width === undefined
      ? containingBlock.width - left - right
      : containingBlock.width - inset * 2) -
    margin * 2;
  const heightFallback =
    (style.position === "absolute" &&
    bottom !== undefined &&
    style.height === undefined
      ? containingBlock.height - top - bottom
      : containingBlock.height - inset * 2) -
    margin * 2;
  const width = clampLength(
    resolveLength(style.width, containingBlock.width, widthFallback),
    style.minWidth,
    style.maxWidth,
    containingBlock.width,
  );
  const height = clampLength(
    resolveLength(style.height, containingBlock.height, heightFallback),
    style.minHeight,
    style.maxHeight,
    containingBlock.height,
  );

  const x =
    containingBlock.x +
    (style.position === "absolute" &&
    style.left === undefined &&
    right !== undefined
      ? containingBlock.width - right - width - margin
      : left + margin);
  const y =
    containingBlock.y +
    (style.position === "absolute" &&
    style.top === undefined &&
    bottom !== undefined
      ? containingBlock.height - bottom - height - margin
      : top + margin);

  const padding = readLength(style.padding, Math.min(width, height), 0);
  const content = {
    x: x + padding,
    y: y + padding,
    width: Math.max(0, width - padding * 2),
    height: Math.max(0, height - padding * 2),
  };

  const children =
    style.display === "flex"
      ? layoutFlexChildren(node.children, content, style)
      : node.children.map((child) => layoutNode(child, content));

  return {
    id: node.id,
    x,
    y,
    width,
    height,
    node,
    children,
  };
}

function layoutFlexChildren(
  children: ResolvedNode[],
  content: { x: number; y: number; width: number; height: number },
  style: SceneStyle,
): LayoutBox[] {
  const direction = style.flexDirection ?? "row";
  const gap = readLength(
    style.gap,
    direction === "row" ? content.width : content.height,
    0,
  );
  const childBoxes = children.map((child) => {
    const estimatedWidth = estimateNodeWidth(child);
    const estimatedHeight = estimateNodeHeight(child);
    let childWidth = resolveLength(
      child.style.width,
      content.width,
      Math.min(content.width, estimatedWidth),
    );
    let childHeight = resolveLength(
      child.style.height,
      content.height,
      Math.min(content.height, estimatedHeight),
    );

    if (style.alignItems === "stretch") {
      // Stretch fills the cross axis for children without an explicit size.
      if (direction === "row" && child.style.height === undefined) {
        childHeight = content.height;
      }

      if (direction === "column" && child.style.width === undefined) {
        childWidth = content.width;
      }
    }

    return { child, width: childWidth, height: childHeight };
  });

  const mainTotal =
    childBoxes.reduce(
      (total, child) =>
        total + (direction === "row" ? child.width : child.height),
      0,
    ) +
    Math.max(0, childBoxes.length - 1) * gap;
  const mainSpace = direction === "row" ? content.width : content.height;
  const crossSpace = direction === "row" ? content.height : content.width;
  // space-between distributes leftover main-axis space on top of `gap`.
  const betweenGap =
    style.justifyContent === "space-between" && childBoxes.length > 1
      ? Math.max(0, mainSpace - mainTotal) / (childBoxes.length - 1)
      : 0;
  let cursor =
    style.justifyContent === "center" ? (mainSpace - mainTotal) / 2 : 0;

  if (style.justifyContent === "flex-end") {
    cursor = mainSpace - mainTotal;
  }

  return childBoxes.map(({ child, width, height }) => {
    const crossSize = direction === "row" ? height : width;
    let crossOffset = 0;

    if (style.alignItems === "center") {
      crossOffset = (crossSpace - crossSize) / 2;
    } else if (style.alignItems === "flex-end") {
      crossOffset = crossSpace - crossSize;
    }

    const box =
      direction === "row"
        ? layoutNode(child, {
            x: content.x + cursor,
            y: content.y + crossOffset,
            width,
            height,
          })
        : layoutNode(child, {
            x: content.x + crossOffset,
            y: content.y + cursor,
            width,
            height,
          });

    cursor += (direction === "row" ? width : height) + gap + betweenGap;
    return box;
  });
}

function clampLength(
  value: number,
  min: string | number | undefined,
  max: string | number | undefined,
  parent: number,
): number {
  let clamped = value;

  if (max !== undefined) {
    clamped = Math.min(clamped, readLength(max, parent, clamped));
  }

  // CSS semantics: min wins over max when they conflict.
  if (min !== undefined) {
    clamped = Math.max(clamped, readLength(min, parent, clamped));
  }

  return clamped;
}

function estimateNodeWidth(node: ResolvedNode): number {
  if (node.type === "text") {
    const fontSize = readLength(node.style.fontSize, 0, 24);
    const longestLine = (node.text ?? " ")
      .split("\n")
      .reduce((longest, line) => Math.max(longest, line.length), 1);
    return longestLine * fontSize * 0.58;
  }

  return 0;
}

function estimateNodeHeight(node: ResolvedNode): number {
  if (node.type === "text") {
    const fontSize = readLength(node.style.fontSize, 0, 24);
    const lineCount = (node.text ?? "").split("\n").length;
    return lineCount * resolveLineHeight(node.style.lineHeight, fontSize);
  }

  return 0;
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

function resolveLength(
  value: string | number | undefined,
  parent: number,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }

  return readLength(value, parent, fallback);
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

// Inline SVG badge so the sample scene exercises image assets without any
// network dependency. Kept tiny and deterministic.
const sampleBadgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><circle cx="80" cy="80" r="72" fill="#ffd166"/><circle cx="80" cy="80" r="56" fill="#101820"/><path d="M52 96 80 44l28 52H92l-12-24-12 24z" fill="#ffd166"/></svg>`;

export function sampleScene(): Scene {
  return composition({ width: 1080, height: 1920, fps: 30, duration: 120 })
    .asset({
      id: "badge",
      type: "image",
      src: `data:image/svg+xml;base64,${toBase64(sampleBadgeSvg)}`,
    })
    .children(
      div({
        id: "background",
        duration: 120,
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #101820 0%, #244f46 100%)",
        },
      }),
      img("badge", {
        id: "badge-mark",
        duration: 120,
        style: {
          position: "absolute",
          left: 460,
          top: 360,
          width: 160,
          height: 160,
          objectFit: "contain",
        },
      }).animate("opacity", [
        { frame: 0, value: 0 },
        { frame: 18, value: 1, easing: "easeOut" },
      ]),
      div({
        id: "subtitle-wrap",
        duration: 120,
        style: {
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 160,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        },
      }).children(
        text("Forge motion in the browser", {
          id: "subtitle",
          duration: 120,
          style: {
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: 76,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            textShadow: "0 6px 28px rgba(0,0,0,0.45)",
          },
        }).animate("opacity", [
          { frame: 0, value: 0 },
          { frame: 12, value: 1, easing: "easeOut" },
          { frame: 100, value: 1 },
          { frame: 119, value: 0, easing: "easeIn" },
        ]),
      ),
    )
    .toJSON();
}

/** Base64 that works in browsers (btoa) and Node (Buffer) without DOM types. */
function toBase64(value: string): string {
  const globalScope = globalThis as {
    btoa?: (data: string) => string;
    Buffer?: {
      from(
        data: string,
        encoding: string,
      ): { toString(encoding: string): string };
    };
  };

  if (typeof globalScope.btoa === "function") {
    return globalScope.btoa(value);
  }

  if (globalScope.Buffer) {
    return globalScope.Buffer.from(value, "utf-8").toString("base64");
  }

  throw new Error("No base64 encoder available in this environment.");
}
