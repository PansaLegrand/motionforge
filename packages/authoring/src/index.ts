import type {
  Scene,
  SceneAnimation,
  SceneAsset,
  SceneStyle,
} from "@motionforge/schema";
import {
  audio,
  composition,
  div,
  img,
  text,
  video,
  type AudioNodeOptions,
  type NodeOptions,
  type VideoNodeOptions,
} from "@motionforge/core";
export { fadeUp, popIn, pulse, slideIn } from "@motionforge/presets";

export type TimeValue = {
  unit: "frames" | "seconds";
  value: number;
};

export type SceneSize =
  | "portrait"
  | "landscape"
  | "square"
  | {
      width: number;
      height: number;
    };

export type AuthorNode = {
  assets?: readonly SceneAsset[];
  toNode(fps: number, scene: ResolvedSceneOptions): ReturnType<typeof div>;
};

export type MakeSceneOptions = {
  size: SceneSize;
  fps?: number;
  duration: TimeValue;
  assets?: Record<string, SceneAsset> | SceneAsset[];
  children?: AuthorNode[];
};

export type AuthorTimingOptions = {
  id?: string;
  at?: TimeValue;
  duration?: TimeValue;
};

export type VisualOptions = AuthorTimingOptions & {
  style?: SceneStyle;
  enter?: SceneAnimation[];
};

export type BoxOptions = VisualOptions & {
  children?: AuthorNode[];
};

export type TextOptions = VisualOptions;

export type TextBoxPlacement =
  | "center"
  | "top"
  | "bottom"
  | "title"
  | "subtitle"
  | "lowerThird"
  | "statCallout";

export type TextBoxSafeArea =
  | boolean
  | number
  | {
      x?: number;
      y?: number;
      top?: number;
      right?: number;
      bottom?: number;
      left?: number;
    };

export type TextBoxOptions = TextOptions & {
  placement?: TextBoxPlacement;
  safeArea?: TextBoxSafeArea;
  fit?: SceneStyle["textFit"];
  maxLines?: number;
  minFontSize?: number;
};

export type MediaOptions = VisualOptions & {
  objectFit?: SceneStyle["objectFit"];
  objectPosition?: SceneStyle["objectPosition"];
};

export type VideoClipOptions = MediaOptions & {
  trimStart?: TimeValue;
  playbackRate?: number;
  volume?: number;
};

export type AudioTrackOptions = AuthorTimingOptions & {
  trimStart?: TimeValue;
  volume?: number;
};

export type AuthorAsset<T extends SceneAsset["type"] = SceneAsset["type"]> =
  SceneAsset & {
    type: T;
  };

export type AssetReference<T extends SceneAsset["type"]> =
  | string
  | AuthorAsset<T>;

type ResolvedSceneOptions = {
  width: number;
  height: number;
  durationFrames: number;
};

export function seconds(value: number): TimeValue {
  return { unit: "seconds", value };
}

export function frames(value: number): TimeValue {
  return { unit: "frames", value };
}

export function time(value: number, unit: "seconds" | "frames"): TimeValue {
  return { unit, value };
}

export function toFrames(value: TimeValue | undefined, fps: number): number {
  if (value === undefined) {
    return 0;
  }

  return value.unit === "seconds"
    ? Math.round(value.value * fps)
    : Math.round(value.value);
}

export function toSeconds(value: TimeValue | undefined, fps: number): number {
  if (value === undefined) {
    return 0;
  }

  return value.unit === "seconds" ? value.value : value.value / fps;
}

export function publicAsset(path: string): string {
  const trimmed = path.trim();

  if (trimmed === "") {
    throw new Error("publicAsset() requires a non-empty path.");
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    return trimmed;
  }

  const normalized = trimmed
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .replace(/^\/+/, "");
  const withoutPublic = normalized.startsWith("public/")
    ? normalized.slice("public/".length)
    : normalized;
  const segments = withoutPublic.split("/").filter(Boolean);

  if (segments.length === 0 || segments.includes("..")) {
    throw new Error(
      'publicAsset() paths must stay inside the project "public" directory.',
    );
  }

  return `/${segments.join("/")}`;
}

export function imageAsset(id: string, src: string): AuthorAsset<"image"> {
  return makeAsset(id, "image", src);
}

export function videoAsset(id: string, src: string): AuthorAsset<"video"> {
  return makeAsset(id, "video", src);
}

export function audioAsset(id: string, src: string): AuthorAsset<"audio"> {
  return makeAsset(id, "audio", src);
}

export function defineAssets(
  ...assets: SceneAsset[]
): Record<string, SceneAsset>;
export function defineAssets(
  assets: readonly SceneAsset[],
): Record<string, SceneAsset>;
export function defineAssets(
  ...assetsOrList: [readonly SceneAsset[]] | SceneAsset[]
): Record<string, SceneAsset> {
  const assets =
    assetsOrList.length === 1 && Array.isArray(assetsOrList[0])
      ? assetsOrList[0]
      : (assetsOrList as SceneAsset[]);

  return Object.fromEntries(assets.map((asset) => [asset.id, asset]));
}

export function makeScene(options: MakeSceneOptions): Scene {
  const fps = options.fps ?? 30;
  const size = resolveSceneSize(options.size);
  const durationFrames = Math.max(1, toFrames(options.duration, fps));
  const sceneOptions = { ...size, durationFrames };
  const builder = composition({
    width: size.width,
    height: size.height,
    fps,
    duration: durationFrames,
  });

  for (const asset of collectAuthorNodeAssets(options.children)) {
    builder.asset(asset);
  }

  for (const asset of normalizeAssets(options.assets)) {
    builder.asset(asset);
  }

  builder.children(
    ...(options.children ?? []).map((child) => child.toNode(fps, sceneOptions)),
  );

  return builder.toJSON();
}

export function bg(color: string, options: Omit<BoxOptions, "style"> = {}) {
  return box({
    ...options,
    style: {
      backgroundColor: color,
      ...fullFrameStyle(),
    },
  });
}

export function box(options: BoxOptions = {}): AuthorNode {
  return {
    assets: collectAuthorNodeAssets(options.children),
    toNode(fps, scene) {
      const node = div({
        ...timedNodeOptions(options, fps),
        style: {
          ...defaultVisualStyle(scene),
          ...options.style,
        },
      });

      for (const animation of options.enter ?? []) {
        node.animate(animation.property, animation.frames);
      }

      if (options.children?.length) {
        node.children(
          ...options.children.map((child) => child.toNode(fps, scene)),
        );
      }

      return node;
    },
  };
}

export function title(value: string, options: TextOptions = {}): AuthorNode {
  return {
    toNode(fps, scene) {
      return textNode(value, {
        ...options,
        style: {
          ...centeredTextStyle(scene),
          top: Math.round(scene.height * 0.375),
          fontSize: Math.max(40, Math.round(scene.height * 0.046)),
          fontWeight: 900,
          ...options.style,
        },
      }).toNode(fps, scene);
    },
  };
}

export function textBlock(value: string, options: TextOptions = {}): AuthorNode {
  return {
    toNode(fps, scene) {
      return textNode(value, {
        ...options,
        style: {
          ...centeredTextStyle(scene),
          top: Math.round(scene.height * 0.49),
          fontSize: Math.max(24, Math.round(scene.height * 0.022)),
          fontWeight: 700,
          lineHeight: 1.18,
          color: "rgba(255,255,255,0.82)",
          ...options.style,
        },
      }).toNode(fps, scene);
    },
  };
}

export function textBox(value: string, options: TextBoxOptions = {}): AuthorNode {
  return {
    toNode(fps, scene) {
      return textNode(value, {
        ...options,
        style: {
          ...textBoxStyle(scene, options),
          ...options.style,
        },
      }).toNode(fps, scene);
    },
  };
}

export function textNode(value: string, options: TextOptions = {}): AuthorNode {
  return {
    toNode(fps) {
      const node = text(value, {
        ...timedNodeOptions(options, fps),
        style: options.style,
      });

      for (const animation of options.enter ?? []) {
        node.animate(animation.property, animation.frames);
      }

      return node;
    },
  };
}

export function image(
  asset: AssetReference<"image">,
  options: MediaOptions = {},
): AuthorNode {
  return {
    assets: assetsFromReference(asset),
    toNode(fps, scene) {
      const node = img(assetIdFromReference(asset), {
        ...timedNodeOptions(options, fps),
        style: mediaStyle(scene, options),
      });

      for (const animation of options.enter ?? []) {
        node.animate(animation.property, animation.frames);
      }

      return node;
    },
  };
}

export function videoClip(
  asset: AssetReference<"video">,
  options: VideoClipOptions = {},
): AuthorNode {
  return {
    assets: assetsFromReference(asset),
    toNode(fps, scene) {
      const nodeOptions: VideoNodeOptions = {
        ...timedNodeOptions(options, fps),
        style: mediaStyle(scene, options),
        videoStartTime: toSeconds(options.trimStart, fps),
        playbackRate: options.playbackRate,
      };
      const node = video(assetIdFromReference(asset), {
        ...nodeOptions,
        volume: options.volume,
      } as VideoNodeOptions & { volume?: number });

      for (const animation of options.enter ?? []) {
        node.animate(animation.property, animation.frames);
      }

      return node;
    },
  };
}

export function audioTrack(
  asset: AssetReference<"audio">,
  options: AudioTrackOptions = {},
): AuthorNode {
  return {
    assets: assetsFromReference(asset),
    toNode(fps) {
      const nodeOptions: AudioNodeOptions = {
        ...timedNodeOptions(options, fps),
        audioStartTime: toSeconds(options.trimStart, fps),
        volume: options.volume,
      };

      return audio(assetIdFromReference(asset), nodeOptions);
    },
  };
}

function makeAsset<T extends SceneAsset["type"]>(
  id: string,
  type: T,
  src: string,
): AuthorAsset<T> {
  return { id, type, src };
}

function assetIdFromReference(asset: AssetReference<SceneAsset["type"]>) {
  return typeof asset === "string" ? asset : asset.id;
}

function assetsFromReference(
  asset: AssetReference<SceneAsset["type"]>,
): readonly SceneAsset[] {
  return typeof asset === "string" ? [] : [asset];
}

function collectAuthorNodeAssets(nodes: readonly AuthorNode[] = []) {
  return nodes.flatMap((node) => node.assets ?? []);
}

function timedNodeOptions(
  options: AuthorTimingOptions,
  fps: number,
): Pick<NodeOptions, "id" | "from" | "duration"> {
  return {
    id: options.id,
    from: toFrames(options.at, fps),
    duration:
      options.duration === undefined ? undefined : toFrames(options.duration, fps),
  };
}

function mediaStyle(scene: ResolvedSceneOptions, options: MediaOptions) {
  return {
    ...defaultVisualStyle(scene),
    objectFit: options.objectFit ?? "cover",
    objectPosition: options.objectPosition ?? "center center",
    ...options.style,
  };
}

function defaultVisualStyle(scene: ResolvedSceneOptions): SceneStyle {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: scene.width,
    height: scene.height,
  };
}

function fullFrameStyle(): SceneStyle {
  return {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
  };
}

function centeredTextStyle(scene: ResolvedSceneOptions): SceneStyle {
  const inset = Math.round(scene.width * 0.067);

  return {
    position: "absolute",
    left: inset,
    right: inset,
    color: "#ffffff",
    textAlign: "center",
  };
}

type ResolvedSafeArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type TextBoxPlacementDefaults = {
  box: Required<Pick<SceneStyle, "left" | "top" | "width" | "height">>;
  textAlign: NonNullable<SceneStyle["textAlign"]>;
  fontSize: number;
  fontWeight: NonNullable<SceneStyle["fontWeight"]>;
  lineHeight: NonNullable<SceneStyle["lineHeight"]>;
  maxLines: number;
};

function textBoxStyle(
  scene: ResolvedSceneOptions,
  options: TextBoxOptions,
): SceneStyle {
  const placement = options.placement ?? "center";
  const placementDefaults = textBoxPlacementDefaults(
    scene,
    placement,
    resolveTextBoxSafeArea(scene, options.safeArea),
  );
  const fontSize = placementDefaults.fontSize;

  return {
    position: "absolute",
    color: "#ffffff",
    overflow: "hidden",
    textFit: options.fit ?? "shrink",
    textOverflow: "ellipsis",
    minFontSize: options.minFontSize ?? Math.max(14, Math.round(fontSize * 0.55)),
    maxLines: options.maxLines ?? placementDefaults.maxLines,
    ...placementDefaults.box,
    textAlign: placementDefaults.textAlign,
    fontSize,
    fontWeight: placementDefaults.fontWeight,
    lineHeight: placementDefaults.lineHeight,
  };
}

function textBoxPlacementDefaults(
  scene: ResolvedSceneOptions,
  placement: TextBoxPlacement,
  safeArea: ResolvedSafeArea,
): TextBoxPlacementDefaults {
  const availableWidth = Math.max(1, scene.width - safeArea.left - safeArea.right);
  const availableHeight = Math.max(
    1,
    scene.height - safeArea.top - safeArea.bottom,
  );
  const centerHeight = Math.round(scene.height * 0.2);
  const titleHeight = Math.round(scene.height * 0.18);
  const captionHeight = Math.round(scene.height * 0.12);
  const lowerThirdHeight = Math.round(scene.height * 0.15);
  const statHeight = Math.round(scene.height * 0.18);

  switch (placement) {
    case "title":
      return {
        box: {
          left: safeArea.left,
          top: safeArea.top + Math.round(scene.height * 0.05),
          width: availableWidth,
          height: titleHeight,
        },
        textAlign: "center",
        fontSize: Math.max(36, Math.round(scene.height * 0.052)),
        fontWeight: 900,
        lineHeight: 1.06,
        maxLines: 2,
      };
    case "subtitle":
      return {
        box: {
          left: safeArea.left,
          top:
            scene.height -
            safeArea.bottom -
            Math.round(scene.height * 0.11) -
            captionHeight,
          width: availableWidth,
          height: captionHeight,
        },
        textAlign: "center",
        fontSize: Math.max(24, Math.round(scene.height * 0.028)),
        fontWeight: 700,
        lineHeight: 1.18,
        maxLines: 2,
      };
    case "lowerThird":
      return {
        box: {
          left: safeArea.left,
          top:
            scene.height -
            safeArea.bottom -
            Math.round(scene.height * 0.12) -
            lowerThirdHeight,
          width: Math.max(1, Math.round(availableWidth * 0.74)),
          height: lowerThirdHeight,
        },
        textAlign: "left",
        fontSize: Math.max(28, Math.round(scene.height * 0.036)),
        fontWeight: 800,
        lineHeight: 1.12,
        maxLines: 2,
      };
    case "statCallout":
      return {
        box: {
          left: safeArea.left,
          top: safeArea.top + Math.round(scene.height * 0.24),
          width: Math.max(1, Math.round(availableWidth * 0.5)),
          height: statHeight,
        },
        textAlign: "left",
        fontSize: Math.max(42, Math.round(scene.height * 0.06)),
        fontWeight: 900,
        lineHeight: 0.96,
        maxLines: 2,
      };
    case "top":
      return {
        box: {
          left: safeArea.left,
          top: safeArea.top,
          width: availableWidth,
          height: titleHeight,
        },
        textAlign: "center",
        fontSize: Math.max(32, Math.round(scene.height * 0.04)),
        fontWeight: 800,
        lineHeight: 1.12,
        maxLines: 3,
      };
    case "bottom":
      return {
        box: {
          left: safeArea.left,
          top: scene.height - safeArea.bottom - captionHeight,
          width: availableWidth,
          height: captionHeight,
        },
        textAlign: "center",
        fontSize: Math.max(24, Math.round(scene.height * 0.03)),
        fontWeight: 700,
        lineHeight: 1.16,
        maxLines: 2,
      };
    case "center":
      return {
        box: {
          left: safeArea.left,
          top: safeArea.top + Math.round((availableHeight - centerHeight) / 2),
          width: availableWidth,
          height: centerHeight,
        },
        textAlign: "center",
        fontSize: Math.max(32, Math.round(scene.height * 0.044)),
        fontWeight: 800,
        lineHeight: 1.08,
        maxLines: 3,
      };
  }
}

function resolveTextBoxSafeArea(
  scene: ResolvedSceneOptions,
  safeArea: TextBoxSafeArea | undefined,
): ResolvedSafeArea {
  const defaultX = Math.round(Math.min(scene.width, scene.height) * 0.067);
  const defaultY = Math.round(scene.height * 0.06);

  if (safeArea === false) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  if (typeof safeArea === "number") {
    return {
      top: safeArea,
      right: safeArea,
      bottom: safeArea,
      left: safeArea,
    };
  }

  if (typeof safeArea === "object") {
    return {
      top: safeArea.top ?? safeArea.y ?? defaultY,
      right: safeArea.right ?? safeArea.x ?? defaultX,
      bottom: safeArea.bottom ?? safeArea.y ?? defaultY,
      left: safeArea.left ?? safeArea.x ?? defaultX,
    };
  }

  return {
    top: defaultY,
    right: defaultX,
    bottom: defaultY,
    left: defaultX,
  };
}

function resolveSceneSize(size: SceneSize): { width: number; height: number } {
  if (typeof size === "object") {
    return size;
  }

  switch (size) {
    case "landscape":
      return { width: 1920, height: 1080 };
    case "square":
      return { width: 1080, height: 1080 };
    case "portrait":
      return { width: 1080, height: 1920 };
  }
}

function normalizeAssets(
  assets: MakeSceneOptions["assets"],
): SceneAsset[] {
  if (!assets) {
    return [];
  }

  return Array.isArray(assets) ? assets : Object.values(assets);
}
