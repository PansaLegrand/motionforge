import type { SceneAnimation, SceneNode } from "@motionforge/schema";

export type MotionPresetOptions = {
  /** Length of the motion in frames (default 10). */
  durationInFrames?: number;
  /** Node-local frames to wait before the motion starts (default 0). */
  delay?: number;
  /** Easing expression for the arriving keyframe (per-preset default). */
  easing?: string;
};

type Keyframes = SceneAnimation["frames"];

/** Shifts frames by `delay`, holding the first value from frame 0. */
function delayed(frames: Keyframes, delay: number): Keyframes {
  if (delay <= 0) {
    return frames;
  }

  const first = frames[0];
  const shifted = frames.map((entry) => ({
    ...entry,
    frame: entry.frame + delay,
  }));

  return first ? [{ frame: 0, value: first.value }, ...shifted] : shifted;
}

function animation(property: string, frames: Keyframes): SceneAnimation {
  return { kind: "keyframes", property, frames };
}

/** Scale-up entrance with a fade: scale(fromScale) → scale(1), opacity 0 → 1. */
export function popIn(
  options: MotionPresetOptions & { fromScale?: number } = {},
): SceneAnimation[] {
  const duration = options.durationInFrames ?? 10;
  const delay = options.delay ?? 0;
  const easing = options.easing ?? "spring(0.3)";
  const fromScale = options.fromScale ?? 0.8;

  return [
    animation(
      "transform",
      delayed(
        [
          { frame: 0, value: `scale(${fromScale})` },
          { frame: duration, value: "scale(1)", easing },
        ],
        delay,
      ),
    ),
    animation(
      "opacity",
      delayed(
        [
          { frame: 0, value: 0 },
          {
            frame: Math.max(1, Math.round(duration * 0.6)),
            value: 1,
            easing: "easeOut",
          },
        ],
        delay,
      ),
    ),
  ];
}

/** Fade in while drifting up from `distance` pixels below. */
export function fadeUp(
  options: MotionPresetOptions & { distance?: number } = {},
): SceneAnimation[] {
  const duration = options.durationInFrames ?? 12;
  const delay = options.delay ?? 0;
  const easing = options.easing ?? "easeOut";
  const distance = options.distance ?? 40;

  return [
    animation(
      "transform",
      delayed(
        [
          { frame: 0, value: `translate(0px, ${distance}px)` },
          { frame: duration, value: "translate(0px, 0px)", easing },
        ],
        delay,
      ),
    ),
    animation(
      "opacity",
      delayed(
        [
          { frame: 0, value: 0 },
          { frame: duration, value: 1, easing },
        ],
        delay,
      ),
    ),
  ];
}

/** Slide in from a screen edge direction over `distance` pixels. */
export function slideIn(
  direction: "left" | "right" | "up" | "down",
  options: MotionPresetOptions & { distance?: number } = {},
): SceneAnimation[] {
  const duration = options.durationInFrames ?? 12;
  const delay = options.delay ?? 0;
  const easing = options.easing ?? "cubic-bezier(0.22, 1, 0.36, 1)";
  const distance = options.distance ?? 120;
  const offsets: Record<typeof direction, [number, number]> = {
    left: [-distance, 0],
    right: [distance, 0],
    up: [0, -distance],
    down: [0, distance],
  };
  const [x, y] = offsets[direction];

  return [
    animation(
      "transform",
      delayed(
        [
          { frame: 0, value: `translate(${x}px, ${y}px)` },
          { frame: duration, value: "translate(0px, 0px)", easing },
        ],
        delay,
      ),
    ),
    animation(
      "opacity",
      delayed(
        [
          { frame: 0, value: 0 },
          {
            frame: Math.max(1, Math.round(duration * 0.5)),
            value: 1,
            easing: "easeOut",
          },
        ],
        delay,
      ),
    ),
  ];
}

/** A single scale pulse: 1 → peak → 1. */
export function pulse(
  options: MotionPresetOptions & { peak?: number } = {},
): SceneAnimation[] {
  const duration = options.durationInFrames ?? 14;
  const delay = options.delay ?? 0;
  const easing = options.easing ?? "easeInOut";
  const peak = options.peak ?? 1.08;
  const mid = Math.max(1, Math.round(duration / 2));

  return [
    animation(
      "transform",
      delayed(
        [
          { frame: 0, value: "scale(1)" },
          { frame: mid, value: `scale(${peak})`, easing },
          { frame: duration, value: "scale(1)", easing },
        ],
        delay,
      ),
    ),
  ];
}

/** One spoken word with millisecond timestamps (ASR output shape). */
export type CaptionWord = {
  word: string;
  startMs: number;
  endMs: number;
};

export type CaptionStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  /** Color of highlighted words (TikTok) or the active word (karaoke). */
  highlightColor?: string;
  textShadow?: string;
  textStroke?: string;
};

const captionStyleDefaults: Required<CaptionStyle> = {
  fontFamily: "system-ui, Arial, sans-serif",
  fontSize: 112,
  fontWeight: 800,
  color: "#ffffff",
  highlightColor: "#ffd166",
  textShadow: "0 10 40 rgba(0,0,0,0.55)",
  textStroke: "8px #000000",
};

export type CaptionArea = {
  top?: number | string;
  height?: number | string;
};

export type TikTokCaptionOptions = {
  fps: number;
  /** Prefix for generated node ids (default "caption"). */
  idPrefix?: string;
  /** Vertical band the captions occupy (defaults: top "40%", height "20%"). */
  area?: CaptionArea;
  style?: CaptionStyle;
  /** Indices of words to render in highlightColor with a fitted pill behind them. */
  highlightIndices?: number[];
  /** Fitted background behind highlighted words. */
  pill?: {
    color?: string;
    radius?: number;
    paddingX?: number;
    paddingY?: number;
    /** @deprecated Use paddingY. Kept as a compatibility hint for older callers. */
    heightRatio?: number;
  };
  /** Entrance pop per word (set false to disable). */
  pop?:
    | { fromScale?: number; durationInFrames?: number; easing?: string }
    | false;
  /** Keep each word visible until the next one starts (default true). */
  holdBetweenWords?: boolean;
};

const msToFrame = (ms: number, fps: number): number =>
  Math.round((ms / 1000) * fps);

/**
 * The one-word-at-a-time caption style: each word fills the caption area for
 * its spoken span, popping in with a transform tween. Returns a single
 * container node to drop into scene.nodes; placement is `from`/`duration`
 * computed from the word timestamps.
 */
export function tiktokCaptions(
  words: CaptionWord[],
  options: TikTokCaptionOptions,
): SceneNode {
  const prefix = options.idPrefix ?? "caption";
  const style = { ...captionStyleDefaults, ...options.style };
  const highlight = new Set(options.highlightIndices ?? []);
  const pill = {
    color: options.pill?.color ?? "rgba(255, 209, 102, 0.16)",
    radius: options.pill?.radius ?? 36,
    paddingX: options.pill?.paddingX ?? 56,
    paddingY:
      options.pill?.paddingY ??
      Math.round(
        ((options.pill?.heightRatio ?? 1.7) * style.fontSize -
          style.fontSize * 1.25) /
          2,
      ),
  };
  const pop = options.pop === false ? null : (options.pop ?? {});
  const hold = options.holdBetweenWords ?? true;

  const children: SceneNode[] = words.map((entry, index) => {
    const from = msToFrame(entry.startMs, options.fps);
    const nextStart = words[index + 1]?.startMs;
    const endMs = hold && nextStart !== undefined ? nextStart : entry.endMs;
    const duration = Math.max(1, msToFrame(endMs, options.fps) - from);

    const textNode: SceneNode = {
      id: `${prefix}-w${index}-text`,
      type: "text",
      text: entry.word,
      style: {
        width: "100%",
        height: "100%",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: highlight.has(index) ? style.highlightColor : style.color,
        textAlign: "center",
        textShadow: style.textShadow,
        textStroke: style.textStroke,
        ...(highlight.has(index)
          ? {
              textBackgroundColor: pill.color,
              textBackgroundPaddingX: pill.paddingX,
              textBackgroundPaddingY: Math.max(0, pill.paddingY),
              textBackgroundRadius: pill.radius,
            }
          : {}),
      },
      animations: pop
        ? popIn({
            durationInFrames: pop.durationInFrames ?? 5,
            easing: pop.easing ?? "spring(0.3)",
            fromScale: pop.fromScale ?? 0.7,
          })
        : [],
    };

    return {
      id: `${prefix}-w${index}`,
      type: "div",
      from,
      duration,
      style: {
        position: "absolute",
        left: 0,
        width: "100%",
        top: 0,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      },
      children: [textNode],
    };
  });

  return {
    id: prefix,
    type: "div",
    style: {
      position: "absolute",
      left: 0,
      width: "100%",
      top: options.area?.top ?? "40%",
      height: options.area?.height ?? "20%",
    },
    children,
  };
}

export type KaraokeCaptionOptions = {
  fps: number;
  idPrefix?: string;
  area?: CaptionArea;
  style?: CaptionStyle;
  /** Frames the highlight takes to ramp in/out (default 2). */
  rampFrames?: number;
};

/**
 * The accumulating karaoke style: the whole line is visible for its full
 * span and each word's color ramps to the highlight color while it is being
 * spoken. Returns a single container node.
 */
export function karaokeCaptions(
  words: CaptionWord[],
  options: KaraokeCaptionOptions,
): SceneNode {
  const prefix = options.idPrefix ?? "karaoke";
  const style = { ...captionStyleDefaults, ...options.style };
  const ramp = Math.max(1, options.rampFrames ?? 2);
  const first = words[0];
  const last = words[words.length - 1];

  if (!first || !last) {
    throw new Error("karaokeCaptions needs at least one word.");
  }

  const lineFrom = msToFrame(first.startMs, options.fps);
  const lineDuration = Math.max(
    1,
    msToFrame(last.endMs, options.fps) - lineFrom,
  );

  const children: SceneNode[] = words.map((entry, index) => {
    // Keyframe frames are local to the line container.
    const start = msToFrame(entry.startMs, options.fps) - lineFrom;
    const end = msToFrame(entry.endMs, options.fps) - lineFrom;
    const frames: Keyframes = [];

    if (start - ramp > 0) {
      frames.push({ frame: 0, value: style.color });
    }

    frames.push(
      { frame: Math.max(0, start - ramp), value: style.color },
      { frame: Math.max(1, start), value: style.highlightColor },
      { frame: Math.max(2, end), value: style.highlightColor },
      { frame: Math.max(3, end + ramp), value: style.color },
    );

    // Deduplicate any collapsed frames while keeping order strict.
    const strict: Keyframes = [];

    for (const entry of frames) {
      const previous = strict[strict.length - 1];

      if (!previous) {
        strict.push(entry);
      } else if (entry.frame > previous.frame) {
        strict.push(entry);
      }
    }

    return {
      id: `${prefix}-w${index}`,
      type: "text",
      text: entry.word,
      style: {
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        color: style.color,
        textAlign: "center",
        textShadow: style.textShadow,
        textStroke: style.textStroke,
      },
      animations: [animation("color", strict)],
    } satisfies SceneNode;
  });

  return {
    id: prefix,
    type: "div",
    from: lineFrom,
    duration: lineDuration,
    style: {
      position: "absolute",
      left: 0,
      width: "100%",
      top: options.area?.top ?? "70%",
      height: options.area?.height ?? "15%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: Math.round(style.fontSize * 0.35),
    },
    children,
  };
}

export {
  timeline,
  Timeline,
  type StaggerOptions,
  type TimelinePosition,
} from "./timeline.js";
