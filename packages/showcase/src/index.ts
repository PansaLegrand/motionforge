import { sampleScene } from "@motionforge/core";
import {
  karaokeCaptions,
  tiktokCaptions,
  type CaptionWord,
} from "@motionforge/presets";
import { parseScene, type Scene, type SceneNode } from "@motionforge/schema";

export type ShowcaseScene = {
  id: string;
  title: string;
  description: string;
  proves: string[];
  scene: Scene;
  posterFrame: number;
};

const captionWords: CaptionWord[] = [
  { word: "FORGE", startMs: 800, endMs: 1600 },
  { word: "MOTION", startMs: 1600, endMs: 2400 },
  { word: "IN", startMs: 2400, endMs: 3200 },
  { word: "THE", startMs: 3200, endMs: 4000 },
  { word: "BROWSER", startMs: 4000, endMs: 5000 },
];

const karaokeWords: CaptionWord[] = [
  { word: "JSON", startMs: 500, endMs: 1100 },
  { word: "BECOMES", startMs: 1100, endMs: 1850 },
  { word: "VIDEO", startMs: 1850, endMs: 2600 },
  { word: "IN", startMs: 2600, endMs: 3050 },
  { word: "BROWSER", startMs: 3050, endMs: 4100 },
];

export function introScene(): Scene {
  return sampleScene();
}

export function tiktokCaptionScene(): Scene {
  return parseScene({
    schemaVersion: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 150,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #101820 0%, #244f46 100%)",
        },
        children: [],
      },
      {
        id: "glass-panel",
        type: "div",
        style: {
          position: "absolute",
          left: 90,
          right: 90,
          top: 540,
          height: 760,
          background:
            "linear-gradient(160deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 100%)",
          borderRadius: 42,
        },
        children: [],
      },
      tiktokCaptions(captionWords, {
        fps: 30,
        highlightIndices: [1, 4],
        area: { top: 760, height: 360 },
      }),
      {
        id: "progress-track",
        type: "div",
        style: {
          position: "absolute",
          left: 120,
          right: 120,
          top: 1320,
          height: 14,
          backgroundColor: "rgba(255,255,255,0.22)",
          borderRadius: 12,
          overflow: "hidden",
        },
        children: [
          {
            id: "progress-fill",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              backgroundColor: "#ffd166",
              transform: "translate(-100%, 0px)",
            },
            animations: [
              {
                kind: "keyframes",
                property: "transform",
                frames: [
                  { frame: 0, value: "translate(-100%, 0px)" },
                  {
                    frame: 149,
                    value: "translate(0%, 0px)",
                    easing: "linear",
                  },
                ],
              },
            ],
            children: [],
          },
        ],
      },
    ],
  });
}

export function karaokeCaptionScene(): Scene {
  return parseScene({
    schemaVersion: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 135,
    assets: {},
    nodes: [
      {
        id: "background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #17202a 0%, #4e342e 100%)",
        },
        children: [],
      },
      {
        id: "stage",
        type: "div",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 560,
          height: 520,
          background:
            "linear-gradient(135deg, rgba(78,205,196,0.22) 0%, rgba(255,209,102,0.14) 100%)",
          borderRadius: 36,
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "scale(0.96)" },
              { frame: 18, value: "scale(1)", easing: "spring(0.2)" },
            ],
          },
        ],
        children: [],
      },
      {
        id: "title",
        type: "text",
        text: "KARAOKE CAPTIONS",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 430,
          height: 90,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 46,
          fontWeight: 800,
          letterSpacing: 3,
          color: "#4ecdc4",
          textAlign: "center",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 16, value: 1, easing: "easeOut" },
            ],
          },
        ],
        children: [],
      },
      karaokeCaptions(karaokeWords, {
        fps: 30,
        area: { top: 760, height: 170 },
        rampFrames: 3,
        style: {
          fontSize: 54,
          fontWeight: 850,
          color: "#ffffff",
          highlightColor: "#ffd166",
          textStroke: "5px #000000",
          textShadow: "0 10 32 rgba(0,0,0,0.45)",
        },
      }),
    ],
  });
}

function launchMetricCard(
  id: string,
  label: string,
  value: string,
  left: number,
  top: number,
  color: string,
  delay: number,
): SceneNode {
  return {
    id,
    type: "div",
    style: {
      position: "absolute",
      left,
      top,
      width: 372,
      height: 160,
      background:
        "linear-gradient(135deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 100%)",
      border: `2px solid ${color}`,
      borderRadius: 22,
      boxShadow: "0 20 48 rgba(0,0,0,0.28)",
      opacity: 0,
      transform: "translate(0px, 38px)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: delay, value: 0 },
          { frame: delay + 14, value: 1, easing: "easeOut" },
        ],
      },
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "translate(0px, 38px)" },
          { frame: delay, value: "translate(0px, 38px)" },
          {
            frame: delay + 18,
            value: "translate(0px, 0px)",
            easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          },
        ],
      },
    ],
    children: [
      {
        id: `${id}-label`,
        type: "text",
        text: label,
        style: {
          position: "absolute",
          left: 28,
          top: 24,
          width: 316,
          height: 34,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 24,
          fontWeight: 800,
          letterSpacing: 2,
          color,
          textAlign: "left",
        },
      },
      {
        id: `${id}-value`,
        type: "text",
        text: value,
        style: {
          position: "absolute",
          left: 28,
          top: 66,
          width: 316,
          height: 58,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 44,
          fontWeight: 850,
          color: "#ffffff",
          textAlign: "left",
          textShadow: "0 8 28 rgba(0,0,0,0.45)",
        },
      },
    ],
  };
}

function launchScanLine(
  id: string,
  top: number,
  delay: number,
  color: string,
): SceneNode {
  return {
    id,
    type: "div",
    style: {
      position: "absolute",
      left: -260,
      top,
      width: 220,
      height: 4,
      backgroundColor: color,
      opacity: 0,
      borderRadius: 4,
      transform: "translate(0px, 0px)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: delay, value: 0 },
          { frame: delay + 10, value: 0.82, easing: "easeOut" },
          { frame: delay + 64, value: 0, easing: "easeIn" },
        ],
      },
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "translate(0px, 0px)" },
          { frame: delay, value: "translate(0px, 0px)" },
          {
            frame: delay + 64,
            value: "translate(1600px, 0px)",
            easing: "linear",
          },
        ],
      },
    ],
  };
}

function countdownText(label: string, index: number): SceneNode {
  return {
    id: `countdown-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    type: "text",
    text: label,
    from: 96 + index * 28,
    duration: label === "GO" ? 56 : 28,
    style: {
      position: "absolute",
      left: 120,
      top: 676,
      width: 840,
      height: 260,
      fontFamily: "system-ui, Arial, sans-serif",
      fontSize: label === "GO" ? 176 : 148,
      fontWeight: 900,
      color: label === "GO" ? "#66f5d7" : "#ffffff",
      textAlign: "center",
      textStroke: "5px rgba(0,0,0,0.55)",
      textShadow: "0 18 58 rgba(0,0,0,0.55)",
      transform: "scale(0.82)",
    },
    animations: [
      {
        kind: "keyframes",
        property: "transform",
        frames: [
          { frame: 0, value: "scale(0.82)" },
          { frame: 10, value: "scale(1)", easing: "spring(0.28)" },
        ],
      },
      {
        kind: "keyframes",
        property: "opacity",
        frames: [
          { frame: 0, value: 0 },
          { frame: 6, value: 1, easing: "easeOut" },
          { frame: label === "GO" ? 48 : 23, value: 1 },
          { frame: label === "GO" ? 55 : 27, value: 0, easing: "easeIn" },
        ],
      },
    ],
  };
}

export function launchInfoDisplayScene(): Scene {
  return parseScene({
    schemaVersion: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 240,
    assets: {},
    nodes: [
      {
        id: "launch-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #10131b 0%, #233945 48%, #2c1f3f 100%)",
        },
      },
      {
        id: "launch-grid",
        type: "div",
        style: {
          position: "absolute",
          left: 84,
          top: 180,
          width: 912,
          height: 1320,
          border: "2px solid rgba(102,245,215,0.25)",
          borderRadius: 34,
          overflow: "hidden",
          background:
            "linear-gradient(90deg, rgba(102,245,215,0.08) 0%, rgba(255,209,102,0.05) 54%, rgba(255,87,122,0.08) 100%)",
        },
        children: [
          launchScanLine(
            "launch-scanline-a",
            180,
            18,
            "rgba(102,245,215,0.92)",
          ),
          launchScanLine(
            "launch-scanline-b",
            520,
            86,
            "rgba(255,209,102,0.86)",
          ),
          launchScanLine(
            "launch-scanline-c",
            900,
            142,
            "rgba(255,87,122,0.82)",
          ),
        ],
      },
      {
        id: "launch-kicker",
        type: "text",
        text: "PROMPT TO VIDEO",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 260,
          height: 46,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: 4,
          color: "#66f5d7",
          textAlign: "center",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 18, value: 1, easing: "easeOut" },
            ],
          },
        ],
      },
      {
        id: "launch-title",
        type: "text",
        text: "Launch Info Display",
        style: {
          position: "absolute",
          left: 96,
          right: 96,
          top: 316,
          height: 108,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 82,
          fontWeight: 900,
          color: "#ffffff",
          textAlign: "center",
          textShadow: "0 16 42 rgba(0,0,0,0.48)",
          transform: "translate(0px, 32px)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 24, value: 1, easing: "easeOut" },
            ],
          },
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "translate(0px, 32px)" },
              {
                frame: 26,
                value: "translate(0px, 0px)",
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            ],
          },
        ],
      },
      launchMetricCard(
        "launch-card-window",
        "WINDOW",
        "07:30 UTC",
        132,
        486,
        "rgba(102,245,215,0.86)",
        34,
      ),
      launchMetricCard(
        "launch-card-payload",
        "PAYLOAD",
        "MOTIONFORGE",
        576,
        486,
        "rgba(255,209,102,0.9)",
        46,
      ),
      launchMetricCard(
        "launch-card-status",
        "STATUS",
        "Nominal",
        132,
        1050,
        "rgba(255,87,122,0.82)",
        72,
      ),
      launchMetricCard(
        "launch-card-target",
        "TARGET",
        "Public Beta",
        576,
        1050,
        "rgba(143,173,255,0.92)",
        84,
      ),
      ...["T-03", "T-02", "T-01", "GO"].map((label, index) =>
        countdownText(label, index),
      ),
      {
        id: "launch-progress-track",
        type: "div",
        style: {
          position: "absolute",
          left: 132,
          right: 132,
          top: 1300,
          height: 18,
          backgroundColor: "rgba(255,255,255,0.16)",
          borderRadius: 12,
          overflow: "hidden",
        },
        children: [
          {
            id: "launch-progress-fill",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              background:
                "linear-gradient(90deg, #66f5d7 0%, #ffd166 54%, #ff577a 100%)",
              transform: "translate(-100%, 0px)",
            },
            animations: [
              {
                kind: "keyframes",
                property: "transform",
                frames: [
                  { frame: 0, value: "translate(-100%, 0px)" },
                  {
                    frame: 210,
                    value: "translate(0%, 0px)",
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "launch-footer",
        type: "text",
        text: "A single prompt becomes timed text, panels, countdown, and motion.",
        style: {
          position: "absolute",
          left: 120,
          right: 120,
          top: 1384,
          height: 92,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 34,
          fontWeight: 700,
          lineHeight: 1.18,
          color: "#d9fff7",
          textAlign: "center",
        },
        animations: [
          {
            kind: "keyframes",
            property: "opacity",
            frames: [
              { frame: 0, value: 0 },
              { frame: 128, value: 0 },
              { frame: 148, value: 1, easing: "easeOut" },
            ],
          },
        ],
      },
    ],
  });
}

export function timedTextOverlayScene(): Scene {
  return parseScene({
    schemaVersion: 0,
    width: 1080,
    height: 1920,
    fps: 30,
    duration: 450,
    assets: {},
    nodes: [
      {
        id: "timed-background",
        type: "div",
        style: {
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(180deg, #18191f 0%, #253947 52%, #17191f 100%)",
        },
      },
      {
        id: "timed-frame",
        type: "div",
        style: {
          position: "absolute",
          left: 72,
          right: 72,
          top: 148,
          bottom: 148,
          border: "2px solid rgba(255,255,255,0.18)",
          borderRadius: 32,
        },
      },
      {
        id: "timed-center-panel",
        type: "div",
        style: {
          position: "absolute",
          left: 144,
          right: 144,
          top: 650,
          height: 520,
          background:
            "linear-gradient(135deg, rgba(102,245,215,0.16) 0%, rgba(255,209,102,0.12) 46%, rgba(255,87,122,0.13) 100%)",
          border: "2px solid rgba(255,255,255,0.16)",
          borderRadius: 28,
          boxShadow: "0 26 70 rgba(0,0,0,0.32)",
        },
      },
      {
        id: "timed-top-text",
        type: "text",
        text: "motionforge.dev",
        from: 0,
        duration: 150,
        style: {
          position: "absolute",
          left: 0,
          top: 74,
          width: "100%",
          height: 118,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 76,
          fontWeight: 900,
          color: "#ff3030",
          textAlign: "center",
          textStroke: "4px rgba(55,0,0,0.72)",
          textShadow: "0 12 34 rgba(0,0,0,0.45)",
        },
      },
      {
        id: "dojo-top-rule",
        type: "div",
        from: 0,
        duration: 150,
        style: {
          position: "absolute",
          left: 360,
          top: 204,
          width: 360,
          height: 6,
          backgroundColor: "#ff3030",
          borderRadius: 5,
          transform: "scale(0.2)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "scale(0.2)" },
              { frame: 18, value: "scale(1)", easing: "easeOut" },
            ],
          },
        ],
      },
      {
        id: "timed-prompt-copy",
        type: "text",
        text: "first 5 seconds: top center\nending 10 seconds: right bottom",
        style: {
          position: "absolute",
          left: 190,
          right: 190,
          top: 804,
          height: 180,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 38,
          fontWeight: 760,
          lineHeight: 1.28,
          color: "#ffffff",
          textAlign: "center",
          textBackgroundColor: "rgba(0,0,0,0.22)",
          textBackgroundPaddingX: 28,
          textBackgroundPaddingY: 12,
          textBackgroundRadius: 18,
        },
      },
      {
        id: "coming-soon-text",
        type: "text",
        text: "Coming soon...",
        from: 150,
        duration: 300,
        style: {
          position: "absolute",
          right: 70,
          bottom: 92,
          width: 520,
          height: 78,
          fontFamily: "system-ui, Arial, sans-serif",
          fontSize: 38,
          fontWeight: 850,
          color: "#ffe45c",
          textAlign: "right",
          textShadow: "0 10 28 rgba(0,0,0,0.54)",
        },
      },
      {
        id: "coming-soon-accent",
        type: "div",
        from: 150,
        duration: 300,
        style: {
          position: "absolute",
          right: 72,
          bottom: 82,
          width: 260,
          height: 5,
          backgroundColor: "#ffe45c",
          borderRadius: 5,
          transform: "translate(260px, 0px)",
        },
        animations: [
          {
            kind: "keyframes",
            property: "transform",
            frames: [
              { frame: 0, value: "translate(260px, 0px)" },
              {
                frame: 16,
                value: "translate(0px, 0px)",
                easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              },
            ],
          },
        ],
      },
      {
        id: "timed-progress-track",
        type: "div",
        style: {
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 188,
          height: 10,
          backgroundColor: "rgba(255,255,255,0.18)",
          borderRadius: 8,
          overflow: "hidden",
        },
        children: [
          {
            id: "timed-progress-fill",
            type: "div",
            style: {
              width: "100%",
              height: "100%",
              background: "linear-gradient(90deg, #ff3030 0%, #ffe45c 100%)",
              transform: "translate(-100%, 0px)",
            },
            animations: [
              {
                kind: "keyframes",
                property: "transform",
                frames: [
                  { frame: 0, value: "translate(-100%, 0px)" },
                  {
                    frame: 449,
                    value: "translate(0%, 0px)",
                    easing: "linear",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
}

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: "intro",
    title: "Engine Intro",
    description:
      "A compact JSON scene with gradients, image assets, text, and opacity keyframes.",
    proves: ["Canvas2D preview", "image assets", "keyframes", "MP4 export"],
    scene: introScene(),
    posterFrame: 40,
  },
  {
    id: "tiktok-captions",
    title: "TikTok Captions",
    description:
      "ASR word timestamps compiled into one-word captions with spring pops, strokes, and measured highlight pills.",
    proves: [
      "caption presets",
      "transform tweens",
      "text stroke",
      "fitted text backgrounds",
    ],
    scene: tiktokCaptionScene(),
    posterFrame: 60,
  },
  {
    id: "karaoke-captions",
    title: "Karaoke Captions",
    description:
      "A full-line caption preset where each word color-ramp follows its spoken timestamp.",
    proves: [
      "ASR timing",
      "color interpolation",
      "spring easing",
      "multi-word layout",
    ],
    scene: karaokeCaptionScene(),
    posterFrame: 78,
  },
  {
    id: "launch-info-display",
    title: "Launch Info Display",
    description:
      "A prompt-to-video style launch screen with animated panels, scan lines, a progress bar, and countdown timing.",
    proves: [
      "prompt-shaped scenes",
      "timed panels",
      "transform tweens",
      "progress motion",
    ],
    scene: launchInfoDisplayScene(),
    posterFrame: 132,
  },
  {
    id: "timed-text-overlay",
    title: "Timed Text Overlay",
    description:
      "A written timing prompt translated into exact scene nodes: first 5 seconds top-center text, final 10 seconds bottom-right text.",
    proves: [
      "text overlays",
      "frame-accurate timing",
      "absolute placement",
      "color styling",
    ],
    scene: timedTextOverlayScene(),
    posterFrame: 210,
  },
];

export function findShowcaseScene(id: string): ShowcaseScene | undefined {
  return showcaseScenes.find((entry) => entry.id === id);
}
