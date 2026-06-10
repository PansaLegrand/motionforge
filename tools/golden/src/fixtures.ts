import type { Scene } from "@motionforge/schema";

export type ExactGoldenFixture = {
  kind: "exact";
  id: string;
  description: string;
  frame: number;
  scene: Scene;
};

export type ProbeGoldenFixture = {
  kind: "probe";
  id: string;
  description: string;
  frame: number;
  scene: Scene;
  probes: Array<{
    label: string;
    x: number;
    y: number;
    minAlpha?: number;
    notRgb?: [number, number, number];
  }>;
};

export type GoldenFixture = ExactGoldenFixture | ProbeGoldenFixture;

export const fixtures: GoldenFixture[] = [
  {
    kind: "exact",
    id: "paint-gradient",
    description: "Solid layout box with vertical gradient background.",
    frame: 0,
    scene: {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "background",
          type: "div",
          from: 0,
          duration: 1,
          style: {
            width: "100%",
            height: "100%",
            background: "linear-gradient(180deg, #101820 0%, #244f46 100%)",
          },
          children: [],
        },
      ],
    },
  },
  {
    kind: "exact",
    id: "absolute-insets",
    description:
      "Absolute positioning resolves left, right, bottom, height, and padding.",
    frame: 0,
    scene: {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "root",
          type: "div",
          from: 0,
          duration: 1,
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: "#101820",
          },
          children: [
            {
              id: "bar",
              type: "div",
              from: 0,
              duration: 1,
              style: {
                position: "absolute",
                left: 24,
                right: 40,
                bottom: 28,
                height: 48,
                backgroundColor: "#ffd166",
                borderRadius: 8,
              },
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    kind: "exact",
    id: "opacity-keyframe",
    description: "Numeric keyframes resolve opacity at the requested frame.",
    frame: 15,
    scene: {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 31,
      assets: {},
      nodes: [
        {
          id: "background",
          type: "div",
          from: 0,
          duration: 31,
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: "#101820",
          },
          children: [],
        },
        {
          id: "fade-box",
          type: "div",
          from: 0,
          duration: 31,
          style: {
            position: "absolute",
            left: 80,
            top: 45,
            width: 160,
            height: 90,
            backgroundColor: "#ffffff",
            opacity: 0,
          },
          animations: [
            {
              kind: "keyframes",
              property: "opacity",
              frames: [
                { frame: 0, value: 0 },
                { frame: 30, value: 1 },
              ],
            },
          ],
          children: [],
        },
      ],
    },
  },
  {
    kind: "exact",
    id: "flex-centered-box",
    description:
      "Flex layout centers a fixed-size child inside a padded parent.",
    frame: 0,
    scene: {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 1,
      assets: {},
      nodes: [
        {
          id: "root",
          type: "div",
          from: 0,
          duration: 1,
          style: {
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            backgroundColor: "#101820",
          },
          children: [
            {
              id: "center",
              type: "div",
              from: 0,
              duration: 1,
              style: {
                width: 80,
                height: 48,
                backgroundColor: "#4ecdc4",
                borderRadius: 6,
              },
              children: [],
            },
          ],
        },
      ],
    },
  },
  {
    kind: "probe",
    id: "text-shadow-presence",
    description: "Text and text shadow render without exact glyph hashing.",
    frame: 12,
    scene: {
      schemaVersion: 0,
      width: 320,
      height: 180,
      fps: 30,
      duration: 30,
      assets: {},
      nodes: [
        {
          id: "background",
          type: "div",
          from: 0,
          duration: 30,
          style: {
            width: "100%",
            height: "100%",
            backgroundColor: "#101820",
          },
          children: [],
        },
        {
          id: "label",
          type: "text",
          text: "Forge",
          from: 0,
          duration: 30,
          style: {
            position: "absolute",
            left: 96,
            top: 70,
            width: 128,
            height: 40,
            fontFamily: "Arial, sans-serif",
            fontSize: 38,
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            textShadow: "0 4px 8px rgba(0,0,0,0.6)",
          },
          children: [],
        },
      ],
    },
    probes: [
      {
        label: "glyph area is not background",
        x: 160,
        y: 91,
        minAlpha: 255,
        notRgb: [16, 24, 32],
      },
    ],
  },
];
