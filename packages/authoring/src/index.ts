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

export function image(assetId: string, options: MediaOptions = {}): AuthorNode {
  return {
    toNode(fps, scene) {
      const node = img(assetId, {
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
  assetId: string,
  options: VideoClipOptions = {},
): AuthorNode {
  return {
    toNode(fps, scene) {
      const nodeOptions: VideoNodeOptions = {
        ...timedNodeOptions(options, fps),
        style: mediaStyle(scene, options),
        videoStartTime: toSeconds(options.trimStart, fps),
        playbackRate: options.playbackRate,
      };
      const node = video(assetId, {
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
  assetId: string,
  options: AudioTrackOptions = {},
): AuthorNode {
  return {
    toNode(fps) {
      const nodeOptions: AudioNodeOptions = {
        ...timedNodeOptions(options, fps),
        audioStartTime: toSeconds(options.trimStart, fps),
        volume: options.volume,
      };

      return audio(assetId, nodeOptions);
    },
  };
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
