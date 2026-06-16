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
  fontStyle?: "normal" | "italic";
  color?: string;
  /** Color of highlighted words (TikTok) or the active word (karaoke). */
  highlightColor?: string;
  lineHeight?: number | string;
  letterSpacing?: number | string;
  textShadow?: string;
  textStroke?: string;
};

const captionStyleDefaults: Required<CaptionStyle> = {
  fontFamily: "system-ui, Arial, sans-serif",
  fontSize: 112,
  fontWeight: 800,
  fontStyle: "normal",
  color: "#ffffff",
  highlightColor: "#ffd166",
  lineHeight: 1.08,
  letterSpacing: 0,
  textShadow: "0px 10px 40px rgba(0,0,0,0.55)",
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
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
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
        fontStyle: style.fontStyle,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
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

export type CaptionTemplateCategory = "static" | "karaoke" | "karaokeVariant";

export type CaptionRenderMode = "line" | "karaoke" | "word";

export type CaptionTemplateStyle = CaptionStyle & {
  textBackgroundColor?: string;
  textBackgroundPaddingX?: number;
  textBackgroundPaddingY?: number;
  textBackgroundRadius?: number;
};

export type CaptionTemplateHighlightStyle = {
  color?: string;
  backgroundColor?: string;
  fontWeight?: number | string;
  scale?: number;
  textShadow?: string;
  textBackgroundPaddingX?: number;
  textBackgroundPaddingY?: number;
  textBackgroundRadius?: number;
};

export type CaptionTemplate = {
  name: string;
  description: string;
  category: CaptionTemplateCategory;
  renderMode: CaptionRenderMode;
  style: CaptionTemplateStyle;
  highlightStyle?: CaptionTemplateHighlightStyle;
  segment?: {
    maxWords?: number;
    maxDurationMs?: number;
    gapMs?: number;
  };
};

export const captionTemplates = {
  classic: {
    name: "Classic",
    description: "Clean white subtitles with a strong editorial outline.",
    category: "static",
    renderMode: "line",
    style: {
      fontFamily: "Inter, system-ui, Arial, sans-serif",
      fontSize: 78,
      fontWeight: 800,
      color: "#ffffff",
      lineHeight: 1.22,
      letterSpacing: 1.2,
      textShadow: "2px 2px 8px rgba(0,0,0,0.5)",
      textStroke: "4px rgba(15,23,42,0.92)",
    },
  },
  minimalBar: {
    name: "Minimal Bar",
    description: "Compact caption pills for quiet, readable edits.",
    category: "static",
    renderMode: "line",
    style: {
      fontFamily: "Inter, system-ui, Arial, sans-serif",
      fontSize: 68,
      fontWeight: 700,
      color: "#ffffff",
      lineHeight: 1.18,
      letterSpacing: 2,
      textShadow: "0px 2px 8px rgba(0,0,0,0.34)",
      textBackgroundColor: "rgba(17,24,39,0.74)",
      textBackgroundPaddingX: 30,
      textBackgroundPaddingY: 16,
      textBackgroundRadius: 999,
    },
  },
  handwritten: {
    name: "Handwritten",
    description: "Loose, friendly subtitles with lighter motion pressure.",
    category: "static",
    renderMode: "line",
    style: {
      fontFamily: "Caveat, Bradley Hand, Comic Sans MS, cursive",
      fontSize: 84,
      fontWeight: 500,
      color: "#ffffff",
      lineHeight: 1.2,
      textShadow: "2px 2px 6px rgba(0,0,0,0.56)",
    },
  },
  retro: {
    name: "Retro",
    description: "Golden vintage lettering with a warm hard shadow.",
    category: "static",
    renderMode: "line",
    style: {
      fontFamily: "Rubik Mono One, Impact, system-ui, sans-serif",
      fontSize: 62,
      fontWeight: 900,
      color: "#ffd84d",
      lineHeight: 1.1,
      letterSpacing: 1.4,
      textShadow: "5px 5px 0px #ff4500",
      textStroke: "2px rgba(88,28,13,0.72)",
    },
  },
  cinematic: {
    name: "Cinematic",
    description: "Premium serif captions with a restrained dark backing.",
    category: "static",
    renderMode: "line",
    style: {
      fontFamily: "Georgia, Times New Roman, serif",
      fontSize: 76,
      fontWeight: 700,
      color: "#f8fafc",
      lineHeight: 1.18,
      letterSpacing: 1.4,
      textShadow: "0px 4px 18px rgba(0,0,0,0.45)",
      textBackgroundColor: "rgba(15,23,42,0.58)",
      textBackgroundPaddingX: 28,
      textBackgroundPaddingY: 14,
      textBackgroundRadius: 8,
    },
  },
  storyteller: {
    name: "Storyteller",
    description: "Warm narrative subtitles for interviews and recaps.",
    category: "static",
    renderMode: "line",
    style: {
      fontFamily: "Georgia, Times New Roman, serif",
      fontSize: 70,
      fontWeight: 650,
      color: "#fef3c7",
      lineHeight: 1.28,
      letterSpacing: 0.8,
      textShadow: "0px 3px 12px rgba(0,0,0,0.55)",
    },
  },
  hustle: {
    name: "Hustle",
    description: "One-word punch captions with a red active badge.",
    category: "karaoke",
    renderMode: "word",
    style: {
      fontFamily: "Montserrat, Inter, system-ui, sans-serif",
      fontSize: 84,
      fontWeight: 900,
      color: "#ffffff",
      lineHeight: 1.08,
      textShadow: "0px 4px 14px rgba(0,0,0,0.44)",
      textStroke: "5px rgba(0,0,0,0.9)",
    },
    highlightStyle: {
      color: "#ffffff",
      backgroundColor: "#ff3b30",
      scale: 1.08,
      fontWeight: 900,
      textShadow: "0px 2px 8px rgba(0,0,0,0.36)",
      textBackgroundPaddingX: 20,
      textBackgroundPaddingY: 8,
      textBackgroundRadius: 8,
    },
  },
  spotlight: {
    name: "Spotlight",
    description: "Short-form captions with a bright yellow active pill.",
    category: "karaoke",
    renderMode: "word",
    style: {
      fontFamily: "Poppins, Inter, system-ui, sans-serif",
      fontSize: 88,
      fontWeight: 900,
      color: "#ffffff",
      lineHeight: 1.08,
      textShadow: "0px 6px 18px rgba(0,0,0,0.35)",
      textStroke: "7px rgba(15,23,42,0.92)",
    },
    highlightStyle: {
      color: "#0f172a",
      backgroundColor: "#facc15",
      scale: 1.1,
      fontWeight: 900,
      textShadow: "0px 2px 6px rgba(250,204,21,0.24)",
      textBackgroundPaddingX: 24,
      textBackgroundPaddingY: 9,
      textBackgroundRadius: 999,
    },
  },
  karaoke: {
    name: "Karaoke",
    description: "Full-line captions with active-word color and pill emphasis.",
    category: "karaoke",
    renderMode: "karaoke",
    style: {
      fontFamily: "Poppins, Inter, system-ui, sans-serif",
      fontSize: 76,
      fontWeight: 900,
      color: "#ffffff",
      lineHeight: 1.12,
      textShadow: "0px 4px 14px rgba(0,0,0,0.42)",
      textStroke: "5px rgba(2,6,23,0.9)",
    },
    highlightStyle: {
      color: "#ffffff",
      backgroundColor: "rgba(236,72,153,0.95)",
      scale: 1.1,
      fontWeight: 900,
      textShadow: "0px 4px 10px rgba(190,24,93,0.42)",
      textBackgroundPaddingX: 20,
      textBackgroundPaddingY: 7,
      textBackgroundRadius: 999,
    },
  },
  neon: {
    name: "Neon",
    description: "Electric captions with cyan highlights and soft glow.",
    category: "karaokeVariant",
    renderMode: "karaoke",
    style: {
      fontFamily: "Outfit, Inter, system-ui, sans-serif",
      fontSize: 74,
      fontWeight: 800,
      color: "#ffffff",
      lineHeight: 1.12,
      letterSpacing: 1.6,
      textShadow: "0px 0px 18px rgba(56,189,248,0.75)",
      textStroke: "3px rgba(3,7,18,0.82)",
      textBackgroundColor: "rgba(3,7,18,0.52)",
      textBackgroundPaddingX: 26,
      textBackgroundPaddingY: 12,
      textBackgroundRadius: 16,
    },
    highlightStyle: {
      color: "#e0f2fe",
      backgroundColor: "rgba(125,211,252,0.2)",
      scale: 1.06,
      fontWeight: 800,
      textShadow: "0px 0px 12px rgba(125,211,252,0.85)",
      textBackgroundPaddingX: 16,
      textBackgroundPaddingY: 5,
      textBackgroundRadius: 10,
    },
  },
  future: {
    name: "Future",
    description: "Clean tech subtitles with blue active-word accents.",
    category: "karaokeVariant",
    renderMode: "karaoke",
    style: {
      fontFamily: "Space Grotesk, Inter, system-ui, sans-serif",
      fontSize: 72,
      fontWeight: 800,
      color: "#e2e8f0",
      lineHeight: 1.14,
      letterSpacing: 2.2,
      textShadow: "0px 0px 15px rgba(148,163,184,0.35)",
      textStroke: "2px rgba(56,189,248,0.55)",
      textBackgroundColor: "rgba(15,23,42,0.74)",
      textBackgroundPaddingX: 28,
      textBackgroundPaddingY: 13,
      textBackgroundRadius: 10,
    },
    highlightStyle: {
      color: "#38bdf8",
      backgroundColor: "rgba(14,165,233,0.2)",
      scale: 1.07,
      fontWeight: 800,
      textShadow: "0px 0px 15px rgba(56,189,248,0.6)",
      textBackgroundPaddingX: 16,
      textBackgroundPaddingY: 5,
      textBackgroundRadius: 8,
    },
  },
  terminal: {
    name: "Terminal",
    description: "Code-inspired green captions for technical videos.",
    category: "karaokeVariant",
    renderMode: "karaoke",
    style: {
      fontFamily: "Courier New, ui-monospace, monospace",
      fontSize: 66,
      fontWeight: 800,
      color: "#86efac",
      lineHeight: 1.18,
      letterSpacing: 1.6,
      textShadow: "0px 0px 10px rgba(34,197,94,0.36)",
      textBackgroundColor: "rgba(2,6,23,0.86)",
      textBackgroundPaddingX: 24,
      textBackgroundPaddingY: 12,
      textBackgroundRadius: 10,
    },
    highlightStyle: {
      color: "#dcfce7",
      backgroundColor: "rgba(34,197,94,0.2)",
      scale: 1.03,
      fontWeight: 800,
      textBackgroundPaddingX: 12,
      textBackgroundPaddingY: 4,
      textBackgroundRadius: 5,
    },
  },
  colorShift: {
    name: "Color Shift",
    description: "High-contrast karaoke captions with color-only emphasis.",
    category: "karaokeVariant",
    renderMode: "karaoke",
    style: {
      fontFamily: "Poppins, Inter, system-ui, sans-serif",
      fontSize: 76,
      fontWeight: 900,
      color: "#ffffff",
      lineHeight: 1.12,
      letterSpacing: 1.6,
      textShadow: "0px 4px 14px rgba(0,0,0,0.42)",
      textStroke: "5px rgba(2,6,23,0.9)",
    },
    highlightStyle: {
      color: "#facc15",
      scale: 1.08,
      fontWeight: 900,
      textShadow: "0px 0px 14px rgba(250,204,21,0.55)",
    },
  },
} satisfies Record<string, CaptionTemplate>;

export type CaptionTemplateKey = keyof typeof captionTemplates;

export const captionTemplateEntries = Object.entries(captionTemplates) as Array<
  [CaptionTemplateKey, CaptionTemplate]
>;

export const subtitleTemplates = captionTemplates;
export type SubtitleTemplateKey = CaptionTemplateKey;

export type StyledCaptionOptions = {
  fps: number;
  idPrefix?: string;
  template?: CaptionTemplateKey;
  renderMode?: CaptionRenderMode;
  area?: CaptionArea;
  style?: Partial<CaptionTemplateStyle>;
  highlightStyle?: CaptionTemplateHighlightStyle;
  maxWordsPerSegment?: number;
  maxSegmentDurationMs?: number;
  gapMs?: number;
  rampFrames?: number;
};

type CaptionSegment = {
  words: CaptionWord[];
  startMs: number;
  endMs: number;
};

/**
 * Community subtitle templates translated into native motionforge scene data.
 * The result is still just nodes, timings, styles, and keyframes; no Remotion,
 * DOM, or adapter layer is involved.
 */
export function styledCaptions(
  words: CaptionWord[],
  options: StyledCaptionOptions,
): SceneNode {
  const key = options.template ?? "classic";
  const template: CaptionTemplate = captionTemplates[key];
  const prefix = options.idPrefix ?? `${key}-captions`;
  const renderMode = options.renderMode ?? template.renderMode;
  const style = { ...template.style, ...options.style };
  const highlightStyle = {
    ...template.highlightStyle,
    ...options.highlightStyle,
  };

  if (renderMode === "word") {
    return wordTemplateCaptions(words, {
      fps: options.fps,
      idPrefix: prefix,
      area: options.area,
      style,
      highlightStyle,
    });
  }

  const segments = segmentCaptionWords(words, {
    maxWords:
      options.maxWordsPerSegment ??
      template.segment?.maxWords ??
      (renderMode === "karaoke" ? 5 : 8),
    maxDurationMs:
      options.maxSegmentDurationMs ??
      template.segment?.maxDurationMs ??
      (renderMode === "karaoke" ? 2200 : 3000),
    gapMs: options.gapMs ?? template.segment?.gapMs ?? 450,
  });

  return {
    id: prefix,
    type: "div",
    style: {
      position: "absolute",
      left: 0,
      width: "100%",
      top: options.area?.top ?? (renderMode === "karaoke" ? "68%" : "72%"),
      height:
        options.area?.height ?? (renderMode === "karaoke" ? "18%" : "16%"),
    },
    children:
      renderMode === "karaoke"
        ? segments.map((segment, index) =>
            karaokeTemplateSegment(segment, index, {
              fps: options.fps,
              prefix,
              style,
              highlightStyle,
              rampFrames: options.rampFrames ?? 3,
            }),
          )
        : segments.map((segment, index) =>
            lineTemplateSegment(segment, index, {
              fps: options.fps,
              prefix,
              style,
            }),
          ),
  };
}

export const styledSubtitles = styledCaptions;

function wordTemplateCaptions(
  words: CaptionWord[],
  options: {
    fps: number;
    idPrefix: string;
    area?: CaptionArea;
    style: CaptionTemplateStyle;
    highlightStyle: CaptionTemplateHighlightStyle;
  },
): SceneNode {
  return tiktokCaptions(words, {
    fps: options.fps,
    idPrefix: options.idPrefix,
    area: options.area ?? { top: "64%", height: "22%" },
    highlightIndices: words.map((_, index) => index),
    style: {
      fontFamily: options.style.fontFamily,
      fontSize: options.style.fontSize,
      fontWeight: options.style.fontWeight,
      fontStyle: options.style.fontStyle,
      lineHeight: options.style.lineHeight,
      letterSpacing: options.style.letterSpacing,
      color: options.style.color,
      highlightColor:
        options.highlightStyle.color ?? options.style.highlightColor,
      textShadow: options.style.textShadow,
      textStroke: options.style.textStroke,
    },
    pill: options.highlightStyle.backgroundColor
      ? {
          color: options.highlightStyle.backgroundColor,
          paddingX: options.highlightStyle.textBackgroundPaddingX ?? 24,
          paddingY: options.highlightStyle.textBackgroundPaddingY ?? 10,
          radius: options.highlightStyle.textBackgroundRadius ?? 999,
        }
      : undefined,
    pop: {
      fromScale: 0.82,
      durationInFrames: 6,
      easing: "spring(0.28)",
    },
  });
}

function lineTemplateSegment(
  segment: CaptionSegment,
  index: number,
  options: {
    fps: number;
    prefix: string;
    style: CaptionTemplateStyle;
  },
): SceneNode {
  const from = msToFrame(segment.startMs, options.fps);
  const duration = Math.max(1, msToFrame(segment.endMs, options.fps) - from);

  return {
    id: `${options.prefix}-s${index}`,
    type: "div",
    from,
    duration,
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    children: [
      {
        id: `${options.prefix}-s${index}-text`,
        type: "text",
        text: captionSegmentText(segment.words),
        style: captionTextStyle(options.style, {
          width: "100%",
          height: "100%",
        }),
        animations: [
          animation("opacity", [
            { frame: 0, value: 0 },
            {
              frame: Math.min(5, Math.max(1, duration - 1)),
              value: 1,
              easing: "easeOut",
            },
          ]),
        ],
      },
    ],
  };
}

function karaokeTemplateSegment(
  segment: CaptionSegment,
  index: number,
  options: {
    fps: number;
    prefix: string;
    style: CaptionTemplateStyle;
    highlightStyle: CaptionTemplateHighlightStyle;
    rampFrames: number;
  },
): SceneNode {
  const from = msToFrame(segment.startMs, options.fps);
  const duration = Math.max(1, msToFrame(segment.endMs, options.fps) - from);
  const fontSize = options.style.fontSize ?? captionStyleDefaults.fontSize;
  const paddingX = options.highlightStyle.textBackgroundPaddingX ?? 14;

  return {
    id: `${options.prefix}-s${index}`,
    type: "div",
    from,
    duration,
    style: {
      position: "absolute",
      left: 0,
      top: 0,
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: Math.round(fontSize * 0.22 + paddingX * 0.35),
    },
    children: segment.words.map((word, wordIndex) =>
      karaokeTemplateWord(word, wordIndex, {
        fps: options.fps,
        prefix: `${options.prefix}-s${index}`,
        lineFrom: from,
        lineDuration: duration,
        style: options.style,
        highlightStyle: options.highlightStyle,
        rampFrames: options.rampFrames,
      }),
    ),
  };
}

function karaokeTemplateWord(
  word: CaptionWord,
  index: number,
  options: {
    fps: number;
    prefix: string;
    lineFrom: number;
    lineDuration: number;
    style: CaptionTemplateStyle;
    highlightStyle: CaptionTemplateHighlightStyle;
    rampFrames: number;
  },
): SceneNode {
  const start = Math.max(
    0,
    msToFrame(word.startMs, options.fps) - options.lineFrom,
  );
  const end = Math.max(
    start + 1,
    msToFrame(word.endMs, options.fps) - options.lineFrom,
  );
  const ramp = Math.max(1, options.rampFrames);
  const baseColor = options.style.color ?? captionStyleDefaults.color;
  const activeColor =
    options.highlightStyle.color ??
    options.style.highlightColor ??
    captionStyleDefaults.highlightColor;
  const activeBackground = options.highlightStyle.backgroundColor;
  const transparentBackground = transparentColor(activeBackground);
  const scale = options.highlightStyle.scale ?? 1;

  return {
    id: `${options.prefix}-w${index}`,
    type: "text",
    text: word.word,
    style: {
      ...captionTextStyle(options.style),
      ...(options.highlightStyle.fontWeight
        ? { fontWeight: options.highlightStyle.fontWeight }
        : {}),
      ...(activeBackground
        ? {
            textBackgroundColor: transparentBackground,
            textBackgroundPaddingX:
              options.highlightStyle.textBackgroundPaddingX ?? 14,
            textBackgroundPaddingY:
              options.highlightStyle.textBackgroundPaddingY ?? 5,
            textBackgroundRadius:
              options.highlightStyle.textBackgroundRadius ?? 8,
          }
        : {}),
    },
    animations: [
      animation(
        "color",
        strictFrames([
          { frame: 0, value: baseColor },
          { frame: Math.max(0, start - ramp), value: baseColor },
          { frame: start, value: activeColor, easing: "easeOut" },
          { frame: end, value: activeColor },
          { frame: end + ramp, value: baseColor, easing: "easeOut" },
        ]),
      ),
      ...(activeBackground
        ? [
            animation(
              "textBackgroundColor",
              strictFrames([
                { frame: 0, value: transparentBackground },
                {
                  frame: Math.max(0, start - ramp),
                  value: transparentBackground,
                },
                { frame: start, value: activeBackground, easing: "easeOut" },
                { frame: end, value: activeBackground },
                {
                  frame: end + ramp,
                  value: transparentBackground,
                  easing: "easeOut",
                },
              ]),
            ),
          ]
        : []),
      ...(scale !== 1
        ? [
            animation(
              "transform",
              strictFrames([
                { frame: 0, value: "scale(1)" },
                { frame: Math.max(0, start - ramp), value: "scale(1)" },
                { frame: start, value: `scale(${scale})`, easing: "easeOut" },
                { frame: end, value: `scale(${scale})` },
                { frame: end + ramp, value: "scale(1)", easing: "easeOut" },
              ]),
            ),
          ]
        : []),
    ],
  };
}

function captionTextStyle(
  style: CaptionTemplateStyle,
  extra: Partial<SceneNode["style"]> = {},
): SceneNode["style"] {
  return {
    fontFamily: style.fontFamily,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    color: style.color,
    textAlign: "center",
    textShadow: style.textShadow,
    textStroke: style.textStroke,
    ...(style.textBackgroundColor
      ? {
          textBackgroundColor: style.textBackgroundColor,
          textBackgroundPaddingX: style.textBackgroundPaddingX ?? 24,
          textBackgroundPaddingY: style.textBackgroundPaddingY ?? 10,
          textBackgroundRadius: style.textBackgroundRadius ?? 12,
        }
      : {}),
    ...extra,
  };
}

function segmentCaptionWords(
  words: CaptionWord[],
  options: { maxWords: number; maxDurationMs: number; gapMs: number },
): CaptionSegment[] {
  const clean = words.filter((entry) => entry.word.trim() !== "");
  const segments: CaptionSegment[] = [];
  let current: CaptionWord[] = [];

  for (const word of clean) {
    const first = current[0];
    const previous = current[current.length - 1];
    const wouldExceedWords = current.length >= options.maxWords;
    const wouldExceedDuration =
      first !== undefined && word.endMs - first.startMs > options.maxDurationMs;
    const largeGap =
      previous !== undefined && word.startMs - previous.endMs > options.gapMs;

    if (
      current.length > 0 &&
      (wouldExceedWords || wouldExceedDuration || largeGap)
    ) {
      segments.push(captionSegment(current));
      current = [];
    }

    current.push(word);
  }

  if (current.length > 0) {
    segments.push(captionSegment(current));
  }

  return segments;
}

function captionSegment(words: CaptionWord[]): CaptionSegment {
  const first = words[0];
  const last = words[words.length - 1];

  return {
    words,
    startMs: first?.startMs ?? 0,
    endMs: last?.endMs ?? first?.endMs ?? 0,
  };
}

function captionSegmentText(words: CaptionWord[]): string {
  return words
    .map((entry) => entry.word.trim())
    .join(" ")
    .replace(/\s+([,.;:!?])/g, "$1");
}

function strictFrames(frames: Keyframes): Keyframes {
  const result: Keyframes = [];

  for (const frame of frames) {
    const previous = result[result.length - 1];

    if (!previous || frame.frame > previous.frame) {
      result.push(frame);
    } else if (frame.frame === previous.frame) {
      result[result.length - 1] = frame;
    }
  }

  return result;
}

function transparentColor(value: string | undefined): string {
  if (!value) {
    return "rgba(0, 0, 0, 0)";
  }

  const hex = value.match(/^#([0-9a-fA-F]{6})$/);
  if (hex) {
    const raw = hex[1] ?? "000000";
    return `rgba(${Number.parseInt(raw.slice(0, 2), 16)}, ${Number.parseInt(raw.slice(2, 4), 16)}, ${Number.parseInt(raw.slice(4, 6), 16)}, 0)`;
  }

  const rgb = value.match(/^rgba?\(([^)]+)\)$/);
  if (rgb) {
    const [r = "0", g = "0", b = "0"] = (rgb[1] ?? "")
      .split(",")
      .map((part) => part.trim());
    return `rgba(${r}, ${g}, ${b}, 0)`;
  }

  return "rgba(0, 0, 0, 0)";
}

export {
  timeline,
  Timeline,
  type StaggerOptions,
  type TimelinePosition,
} from "./timeline.js";
