import { sampleScene } from "@motionforge/core";
import {
  karaokeCaptions,
  tiktokCaptions,
  type CaptionWord,
} from "@motionforge/presets";
import { parseScene, type Scene } from "@motionforge/schema";

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

export const showcaseScenes: ShowcaseScene[] = [
  {
    id: "intro",
    title: "Engine Intro",
    description: "A compact JSON scene with gradients, image assets, text, and opacity keyframes.",
    proves: ["Canvas2D preview", "image assets", "keyframes", "MP4 export"],
    scene: introScene(),
    posterFrame: 40,
  },
  {
    id: "tiktok-captions",
    title: "TikTok Captions",
    description:
      "ASR word timestamps compiled into one-word captions with spring pops, strokes, and measured highlight pills.",
    proves: ["caption presets", "transform tweens", "text stroke", "fitted text backgrounds"],
    scene: tiktokCaptionScene(),
    posterFrame: 60,
  },
  {
    id: "karaoke-captions",
    title: "Karaoke Captions",
    description:
      "A full-line caption preset where each word color-ramp follows its spoken timestamp.",
    proves: ["ASR timing", "color interpolation", "spring easing", "multi-word layout"],
    scene: karaokeCaptionScene(),
    posterFrame: 78,
  },
];

export function findShowcaseScene(id: string): ShowcaseScene | undefined {
  return showcaseScenes.find((entry) => entry.id === id);
}
