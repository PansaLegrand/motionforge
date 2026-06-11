import {
  evaluateScene,
  layoutScene,
  type LayoutBox,
  type ResolvedNode,
} from "@motionforge/core";
import { parseScene, type Scene, type SceneStyle } from "@motionforge/schema";
import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  CanvasSink,
  Input,
} from "mediabunny";

export type RenderOptions = {
  clear?: boolean;
  /** Result of resolveAssets(). Required when the scene draws img/video nodes. */
  assets?: ResolvedAssets;
};

/** A decodable video clip opened by resolveAssets(). */
export type VideoClip = {
  /** Clip duration in seconds. */
  duration: number;
  /** Natural display size of the video track. */
  width: number;
  height: number;
  /** Frame-accurate access to decoded frames; internal to the renderer. */
  sink: CanvasSink;
  /** Underlying input; closed by disposeAssets(). */
  input: Input;
};

/** A decodable audio clip opened by resolveAssets(). */
export type AudioClip = {
  /** Clip duration in seconds. */
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  /** Decoded PCM access; consumed by the export mixer. */
  sink: AudioBufferSink;
  /** Underlying input; closed by disposeAssets(). */
  input: Input;
};

/** A decoded video frame staged for one scene frame by prepareFrame(). */
export type PreparedVideoFrame = {
  image: HTMLCanvasElement | OffscreenCanvas;
  width: number;
  height: number;
  /** The scene frame this image was prepared for; renderStill rejects stale frames. */
  sceneFrame: number;
};

/**
 * Decoded media for a scene, produced by resolveAssets(). Asset loading is
 * the only async phase: given the same scene, frame, and resolved assets,
 * rendering is pure and deterministic.
 */
export type ResolvedAssets = {
  images: Map<string, ImageBitmap>;
  /** Loaded font faces, keyed by asset id (which is the font-family name). */
  fonts: Map<string, FontFace>;
  /** Opened video clips, keyed by asset id. */
  videos: Map<string, VideoClip>;
  /** Frames staged by prepareFrame(), keyed by video node id. */
  videoFrames: Map<string, PreparedVideoFrame>;
  /** Opened audio clips, keyed by asset id. */
  audio: Map<string, AudioClip>;
};

// Fonts registered with the environment's FontFaceSet, keyed by id + src, so
// re-resolving a scene never registers duplicate faces.
const registeredFonts = new Map<string, FontFace>();

/**
 * Fetches and decodes every asset the scene references. Call once per scene
 * (or whenever scene.assets changes) and pass the result to renderStill via
 * options.assets. Throws with the failing asset id and src on any failure;
 * a scene never renders with silently missing media.
 */
export async function resolveAssets(scene: Scene): Promise<ResolvedAssets> {
  const parsed = parseScene(scene);
  const images = new Map<string, ImageBitmap>();
  const fonts = new Map<string, FontFace>();
  const videos = new Map<string, VideoClip>();
  const audio = new Map<string, AudioClip>();

  await Promise.all(
    Object.values(parsed.assets).map(async (asset) => {
      try {
        if (asset.type === "image") {
          const response = await fetchAsset(asset.src);
          images.set(asset.id, await decodeImageBlob(await response.blob()));
        } else if (asset.type === "font") {
          fonts.set(asset.id, await loadFont(asset.id, asset.src));
        } else if (asset.type === "video") {
          videos.set(asset.id, await openVideoClip(asset.src));
        } else if (asset.type === "audio") {
          audio.set(asset.id, await openAudioClip(asset.src));
        }
      } catch (cause) {
        throw new Error(
          `Failed to load ${asset.type} asset "${asset.id}" from ${truncateSrc(asset.src)}: ${cause instanceof Error ? cause.message : String(cause)}`,
          { cause },
        );
      }
    }),
  );

  return { images, fonts, videos, videoFrames: new Map(), audio };
}

/**
 * Releases decoder and file resources held by resolved assets (video and
 * audio inputs). Call when a scene's assets are no longer needed.
 */
export function disposeAssets(assets: ResolvedAssets): void {
  for (const clip of assets.videos.values()) {
    clip.input.dispose();
  }

  for (const clip of assets.audio.values()) {
    clip.input.dispose();
  }

  assets.videos.clear();
  assets.videoFrames.clear();
  assets.audio.clear();
}

async function openAudioClip(src: string): Promise<AudioClip> {
  const response = await fetchAsset(src);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(await response.blob()),
  });
  const track = await input.getPrimaryAudioTrack();

  if (!track) {
    input.dispose();
    throw new Error("the file has no audio track");
  }

  return {
    duration: await input.computeDuration([track]),
    sampleRate: track.sampleRate,
    numberOfChannels: track.numberOfChannels,
    sink: new AudioBufferSink(track),
    input,
  };
}

async function openVideoClip(src: string): Promise<VideoClip> {
  // The whole clip is fetched into memory; fine for short clips, and it
  // keeps frame access deterministic. Streaming sources can come later.
  const response = await fetchAsset(src);
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(await response.blob()),
  });
  const track = await input.getPrimaryVideoTrack();

  if (!track) {
    input.dispose();
    throw new Error("the file has no video track");
  }

  const duration = await input.computeDuration([track]);

  return {
    duration,
    width: track.displayWidth,
    height: track.displayHeight,
    // No canvas pool: prepared frames must stay valid until the next
    // prepareFrame() call, so each decode gets its own canvas.
    sink: new CanvasSink(track),
    input,
  };
}

/**
 * Maps a video node's local frame to a source timestamp in seconds:
 * videoStartTime + (localFrame / fps) * playbackRate, clamped to the clip so
 * scenes outlasting their footage hold the last frame.
 */
export function videoSourceTime(
  localFrame: number,
  fps: number,
  videoStartTime: number,
  playbackRate: number,
  clipDuration: number,
): number {
  const raw = videoStartTime + (localFrame / fps) * playbackRate;
  const lastFrameTime = Math.max(0, clipDuration - 0.001);
  return Math.min(Math.max(0, raw), lastFrameTime);
}

/**
 * Decodes the source frames every active video node needs at the given scene
 * frame and stages them in assets.videoFrames. Must be awaited before
 * renderStill() for scenes containing video nodes; a no-op otherwise.
 */
export async function prepareFrame(
  scene: Scene,
  frame: number,
  assets: ResolvedAssets,
): Promise<void> {
  const parsed = parseScene(scene);

  if (assets.videos.size === 0) {
    return;
  }

  const resolved = evaluateScene(parsed, frame);
  const tasks: Array<Promise<void>> = [];

  const visit = (node: ResolvedNode): void => {
    if (node.type === "video" && node.assetId) {
      const assetId = node.assetId;
      const clip = assets.videos.get(assetId);

      if (!clip) {
        throw new Error(
          `Video node "${node.id}" references asset "${assetId}" which is not in the resolved assets. Call resolveAssets(scene) first.`,
        );
      }

      const timestamp = videoSourceTime(
        node.localFrame,
        parsed.fps,
        node.videoStartTime ?? 0,
        node.playbackRate ?? 1,
        clip.duration,
      );

      tasks.push(
        clip.sink.getCanvas(timestamp).then((wrapped) => {
          if (!wrapped) {
            throw new Error(
              `Video asset "${assetId}" produced no frame at ${timestamp.toFixed(3)}s for node "${node.id}".`,
            );
          }

          assets.videoFrames.set(node.id, {
            image: wrapped.canvas,
            width: wrapped.canvas.width,
            height: wrapped.canvas.height,
            sceneFrame: resolved.frame,
          });
        }),
      );
    }

    for (const child of node.children) {
      visit(child);
    }
  };

  for (const node of resolved.nodes) {
    visit(node);
  }

  await Promise.all(tasks);
}

async function fetchAsset(src: string): Promise<Response> {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response;
}

/**
 * Loads a font asset and registers it with the environment's FontFaceSet
 * under the asset id, so styles reference it as fontFamily: "<asset id>".
 * Registration is idempotent per (id, src) pair.
 */
async function loadFont(id: string, src: string): Promise<FontFace> {
  const cacheKey = `${id} ${src}`;
  const cached = registeredFonts.get(cacheKey);

  if (cached) {
    return cached;
  }

  // Windows expose the set as document.fonts, workers as self.fonts.
  const fontSet =
    typeof document !== "undefined"
      ? document.fonts
      : (globalThis as { fonts?: FontFaceSet }).fonts;

  if (!fontSet) {
    throw new Error(
      "this environment has no FontFaceSet (document.fonts or self.fonts); font assets need a browser or worker context",
    );
  }

  const response = await fetchAsset(src);
  const face = new FontFace(id, await response.arrayBuffer());
  await face.load();
  fontSet.add(face);
  registeredFonts.set(cacheKey, face);
  return face;
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

  for (const box of sortByZIndex(layout.boxes)) {
    drawBox(context, box, options.assets, layout.frame);
  }
}

/**
 * Paint order among siblings: ascending zIndex (default 0), stable for equal
 * values so document order keeps deciding ties. zIndex never affects layout.
 */
function sortByZIndex(boxes: LayoutBox[]): LayoutBox[] {
  return boxes
    .map((box, index) => ({ box, index }))
    .sort((a, b) => {
      const za = a.box.node.style.zIndex ?? 0;
      const zb = b.box.node.style.zIndex ?? 0;
      return za === zb ? a.index - b.index : za - zb;
    })
    .map((entry) => entry.box);
}

function drawBox(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
): void {
  const { node } = box;
  const style = node.style;

  context.save();
  context.globalAlpha *= style.opacity ?? 1;
  applyTransform(context, box, style);

  if (style.filter && style.filter !== "none") {
    // Canvas2D applies the filter per draw call, not to the composited
    // subtree, and a child's own filter replaces (not stacks with) this one.
    // Identical to CSS for leaf media/text nodes — the dominant use. Safari
    // has no context.filter; the assignment is a silent no-op there.
    context.filter = style.filter;
  }

  drawBackground(context, box, style);

  if (style.overflow === "hidden") {
    // Clip own content and the subtree to the border box, following
    // borderRadius — CSS overflow:hidden semantics. The clip lives inside
    // this box's save/restore, so siblings are unaffected.
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
  }

  if (node.type === "text" && node.text) {
    drawText(context, box, node.text, style);
  }

  if (node.type === "img" && node.assetId) {
    drawImage(context, box, node.assetId, style, assets);
  }

  if (node.type === "video" && node.assetId) {
    drawVideo(context, box, node, style, assets, sceneFrame);
  }

  drawBorder(context, box, style);

  for (const child of sortByZIndex(box.children)) {
    drawBox(context, child, assets, sceneFrame);
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

  drawMedia(context, box, style, image, image);
}

function drawVideo(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  node: LayoutBox["node"],
  style: SceneStyle,
  assets: ResolvedAssets | undefined,
  sceneFrame: number,
): void {
  const prepared = assets?.videoFrames.get(node.id);

  if (!prepared) {
    throw new Error(
      `Scene draws video node "${node.id}" but no frame was staged for it. Await prepareFrame(scene, frame, assets) before renderStill.`,
    );
  }

  if (prepared.sceneFrame !== sceneFrame) {
    throw new Error(
      `Video node "${node.id}" has a frame staged for scene frame ${prepared.sceneFrame}, but frame ${sceneFrame} is being rendered. Await prepareFrame(scene, ${sceneFrame}, assets) first.`,
    );
  }

  drawMedia(context, box, style, prepared.image, prepared);
}

function drawMedia(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
  source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas,
  natural: { width: number; height: number },
): void {
  const fitted = computeObjectFit(
    style.objectFit,
    style.objectPosition,
    box,
    natural,
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
    source,
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

  const shadow = style.boxShadow ? parseBoxShadow(style.boxShadow) : null;

  if (shadow) {
    // Canvas shadows emit from painted pixels, so the shadow rides the
    // background fill. A node with boxShadow but no background paints no
    // shadow — documented in scene-format.
    context.save();
    context.shadowColor = shadow.color;
    context.shadowOffsetX = shadow.offsetX;
    context.shadowOffsetY = shadow.offsetY;
    context.shadowBlur = shadow.blur;
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
  } else {
    context.fillRect(box.x, box.y, box.width, box.height);
  }

  if (shadow) {
    context.restore();
  }
}

export type ParsedBoxShadow = {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
};

/**
 * Parses `<offset-x> <offset-y> [blur] <color>` box shadows (px lengths;
 * color last, rgb()/rgba() allowed). Inset and spread are not supported and
 * make the whole value null (no shadow), so unsupported shadows are loud in
 * review rather than subtly wrong.
 */
export function parseBoxShadow(value: string): ParsedBoxShadow | null {
  const tokens: string[] =
    value.trim().match(/(?:[^\s()]+\([^)]*\)|[^\s()]+)/g) ?? [];

  if (tokens.includes("inset")) {
    return null;
  }

  const lengths: number[] = [];
  const colorParts: string[] = [];

  for (const token of tokens) {
    const length = token.match(/^(-?\d+(?:\.\d+)?)(?:px)?$/);

    if (length && colorParts.length === 0) {
      lengths.push(Number.parseFloat(length[1] ?? "0"));
    } else {
      colorParts.push(token);
    }
  }

  if (lengths.length < 2 || lengths.length > 3 || colorParts.length === 0) {
    return null;
  }

  return {
    offsetX: lengths[0] ?? 0,
    offsetY: lengths[1] ?? 0,
    blur: Math.max(0, lengths[2] ?? 0),
    color: colorParts.join(" "),
  };
}

export type ParsedBorder = { width: number; color: string };

/**
 * Parses `<width> [solid] <color>` borders. Only solid is supported; other
 * line styles make the value null.
 */
export function parseBorder(value: string): ParsedBorder | null {
  const tokens = value.trim().match(/(?:[^\s()]+\([^)]*\)|[^\s()]+)/g) ?? [];
  let width: number | null = null;
  const colorParts: string[] = [];

  for (const token of tokens) {
    const length = token.match(/^(\d+(?:\.\d+)?)(?:px)?$/);

    if (length && width === null) {
      width = Number.parseFloat(length[1] ?? "0");
      continue;
    }

    if (token === "solid") {
      continue;
    }

    if (["dashed", "dotted", "double", "groove", "ridge"].includes(token)) {
      return null;
    }

    colorParts.push(token);
  }

  if (width === null || width <= 0 || colorParts.length === 0) {
    return null;
  }

  return { width, color: colorParts.join(" ") };
}

/**
 * Strokes the border inside the border box (CSS border-box sizing), following
 * borderRadius. Painted after the node's own content, before children.
 */
function drawBorder(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  style: SceneStyle,
): void {
  const border = style.border ? parseBorder(style.border) : null;

  if (!border) {
    return;
  }

  const radius = readLength(
    style.borderRadius,
    Math.min(box.width, box.height),
    0,
  );
  const inset = border.width / 2;

  context.save();
  context.strokeStyle = border.color;
  context.lineWidth = border.width;

  if (radius > 0) {
    roundedRect(
      context,
      box.x + inset,
      box.y + inset,
      box.width - border.width,
      box.height - border.width,
      Math.max(0, radius - inset),
    );
    context.stroke();
  } else {
    context.strokeRect(
      box.x + inset,
      box.y + inset,
      box.width - border.width,
      box.height - border.width,
    );
  }

  context.restore();
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

  const stroke = parseTextStroke(style.textStroke, fontSize);
  if (stroke) {
    context.lineWidth = stroke.width;
    context.strokeStyle = stroke.color;
    context.lineJoin = "round";
    context.miterLimit = 2;
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
  const background = parseTextBackground(style, fontSize);

  lines.forEach((line, index) => {
    if (line !== "") {
      const y = firstLineY + index * lineHeight;
      const measuredWidth = Math.min(context.measureText(line).width, box.width);

      if (background) {
        drawTextBackground(context, {
          x: textLineX(
            style.textAlign,
            box,
            x,
            measuredWidth,
            background.paddingX,
          ),
          y: y - lineHeight / 2 - background.paddingY,
          width: measuredWidth + background.paddingX * 2,
          height: lineHeight + background.paddingY * 2,
          radius: background.radius,
          color: background.color,
        });
      }

      if (stroke) {
        context.strokeText(line, x, y, box.width);
      }

      context.fillText(line, x, y, box.width);
    }
  });
}

function textLineX(
  align: SceneStyle["textAlign"],
  box: LayoutBox,
  textX: number,
  textWidth: number,
  paddingX: number,
): number {
  if (align === "center") {
    return textX - textWidth / 2 - paddingX;
  }

  if (align === "right") {
    return textX - textWidth - paddingX;
  }

  return box.x - paddingX;
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

export type ParsedLinearGradient = {
  /** CSS angle in degrees: 0 = to top, 90 = to right, 180 = to bottom. */
  angleDeg: number;
  stops: Array<{ color: string; offset: number }>;
};

/**
 * Parses `linear-gradient(...)` with any number of stops. The direction is a
 * `<deg>` angle or a `to <side>` keyword (default 180deg = to bottom). Stop
 * positions are `%` and may be omitted; omitted positions distribute evenly
 * between their neighbors, like CSS. Returns null for non-gradient values.
 */
export function parseLinearGradient(
  value: string,
): ParsedLinearGradient | null {
  const match = value.trim().match(/^linear-gradient\((.+)\)$/);

  if (!match) {
    return null;
  }

  const parts = splitTopLevel(match[1] ?? "");

  if (parts.length === 0) {
    return null;
  }

  let angleDeg = 180;
  const first = parts[0] ?? "";
  const angle = first.match(/^(-?\d+(?:\.\d+)?)deg$/);
  const side = first.match(/^to\s+(top|right|bottom|left)$/);

  if (angle || side) {
    parts.shift();

    if (angle) {
      angleDeg = Number.parseFloat(angle[1] ?? "180");
    } else if (side) {
      angleDeg = { top: 0, right: 90, bottom: 180, left: 270 }[
        (side[1] ?? "bottom") as "top" | "right" | "bottom" | "left"
      ];
    }
  }

  if (parts.length < 2) {
    return null;
  }

  const stops = parts.map((part) => {
    const positioned = part.match(/^(.*?)\s+(-?\d+(?:\.\d+)?)%$/);

    if (positioned) {
      return {
        color: (positioned[1] ?? "").trim(),
        offset: Number.parseFloat(positioned[2] ?? "0") / 100,
      };
    }

    return { color: part, offset: undefined as number | undefined };
  });

  // Fill in omitted positions: endpoints default to 0/1, interior stops
  // spread evenly between the nearest positioned neighbors.
  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  if (firstStop && firstStop.offset === undefined) {
    firstStop.offset = 0;
  }

  if (lastStop && lastStop.offset === undefined) {
    lastStop.offset = 1;
  }

  for (let index = 1; index < stops.length - 1; index += 1) {
    if (stops[index]?.offset !== undefined) {
      continue;
    }

    const prevIndex = index - 1;
    let nextIndex = index + 1;

    while (stops[nextIndex]?.offset === undefined) {
      nextIndex += 1;
    }

    const start = stops[prevIndex]?.offset ?? 0;
    const end = stops[nextIndex]?.offset ?? 1;
    const span = nextIndex - prevIndex;

    for (let fill = index; fill < nextIndex; fill += 1) {
      const target = stops[fill];

      if (target) {
        target.offset = start + ((end - start) * (fill - prevIndex)) / span;
      }
    }
  }

  let running = 0;

  return {
    angleDeg,
    stops: stops.map((stop) => {
      // Canvas requires non-decreasing offsets in [0, 1]; CSS clamps the
      // same way for out-of-order positions.
      running = Math.min(1, Math.max(running, stop.offset ?? 0));
      return { color: stop.color, offset: running };
    }),
  };
}

/** Splits on commas that are not inside parentheses (rgba(...) stops). */
function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of value) {
    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    }

    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim() !== "") {
    parts.push(current.trim());
  }

  return parts.filter((part) => part !== "");
}

function parseFill(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  box: LayoutBox,
  value: string,
): string | CanvasGradient {
  const parsed = parseLinearGradient(value);

  if (!parsed) {
    return value;
  }

  // CSS gradient line: passes through the box center; its length is the
  // projection of the box onto the gradient direction.
  const radians = (parsed.angleDeg * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians); // canvas y grows downward
  const length =
    Math.abs(box.width * Math.sin(radians)) +
    Math.abs(box.height * Math.cos(radians));
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const gradient = context.createLinearGradient(
    centerX - (dirX * length) / 2,
    centerY - (dirY * length) / 2,
    centerX + (dirX * length) / 2,
    centerY + (dirY * length) / 2,
  );

  for (const stop of parsed.stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

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

export function parseTextStroke(
  value: string | undefined,
  fontSize = 24,
): { width: number; color: string } | null {
  if (!value) {
    return null;
  }

  const match = value.trim().match(/^(\S+)\s+(.+)$/);

  if (!match) {
    return null;
  }

  const width = readLength(match[1], fontSize, Number.NaN);

  if (!Number.isFinite(width) || width <= 0) {
    return null;
  }

  return {
    width,
    color: match[2]?.trim() || "#000000",
  };
}

export type TextBackground = {
  color: string;
  paddingX: number;
  paddingY: number;
  radius: number;
};

export function parseTextBackground(
  style: SceneStyle,
  fontSize = 24,
): TextBackground | null {
  if (!style.textBackgroundColor) {
    return null;
  }

  const padding = readLength(style.textBackgroundPadding, fontSize, 0);
  const paddingX = readLength(style.textBackgroundPaddingX, fontSize, padding);
  const paddingY = readLength(style.textBackgroundPaddingY, fontSize, padding);
  const radius = readLength(style.textBackgroundRadius, fontSize, 0);

  return {
    color: style.textBackgroundColor,
    paddingX: Math.max(0, paddingX),
    paddingY: Math.max(0, paddingY),
    radius: Math.max(0, radius),
  };
}

function drawTextBackground(
  context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  background: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
    color: string;
  },
): void {
  context.save();
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  context.fillStyle = background.color;

  if (background.radius > 0) {
    roundedRect(
      context,
      background.x,
      background.y,
      background.width,
      background.height,
      background.radius,
    );
    context.fill();
  } else {
    context.fillRect(
      background.x,
      background.y,
      background.width,
      background.height,
    );
  }

  context.restore();
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
