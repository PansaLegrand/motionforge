import type { Scene } from "@motionforge/schema";

export const starterScene: Scene = {
  schemaVersion: 0,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 150,
  assets: {},
  nodes: [
    {
      id: "bg",
      type: "div",
      from: 0,
      duration: 150,
      style: {
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(180deg, #f8fafc 0%, #d9f4f2 48%, #ffe4e6 100%)",
      },
      animations: [],
      children: [],
    },
    {
      id: "accent-panel",
      type: "div",
      from: 0,
      duration: 150,
      style: {
        position: "absolute",
        left: 76,
        right: 76,
        top: 500,
        height: 760,
        backgroundColor: "rgba(255,255,255,0.82)",
        border: "2px solid rgba(15,23,42,0.12)",
        borderRadius: 46,
        boxShadow: "0 28px 70px rgba(15,23,42,0.18)",
      },
      animations: [
        {
          kind: "keyframes",
          property: "transform",
          frames: [
            { frame: 0, value: "translate(0px, 42px) scale(0.96)" },
            { frame: 18, value: "translate(0px, 0px) scale(1)", easing: "easeOut" },
          ],
        },
        {
          kind: "keyframes",
          property: "opacity",
          frames: [
            { frame: 0, value: 0 },
            { frame: 14, value: 1, easing: "easeOut" },
          ],
        },
      ],
      children: [],
    },
    {
      id: "eyebrow",
      type: "text",
      text: "MOTIONFORGE",
      from: 0,
      duration: 150,
      style: {
        position: "absolute",
        left: 120,
        right: 120,
        top: 630,
        fontSize: 34,
        fontWeight: 800,
        letterSpacing: 8,
        color: "#0f766e",
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
    {
      id: "title",
      type: "text",
      text: "Chat turns prompts into video scenes",
      from: 0,
      duration: 150,
      style: {
        position: "absolute",
        left: 118,
        right: 118,
        top: 730,
        fontSize: 78,
        fontWeight: 900,
        lineHeight: 1.05,
        color: "#111827",
        textAlign: "center",
      },
      animations: [
        {
          kind: "keyframes",
          property: "transform",
          frames: [
            { frame: 0, value: "scale(0.88)" },
            { frame: 20, value: "scale(1)", easing: "spring(0.32)" },
          ],
        },
        {
          kind: "keyframes",
          property: "opacity",
          frames: [
            { frame: 0, value: 0 },
            { frame: 12, value: 1, easing: "easeOut" },
          ],
        },
      ],
      children: [],
    },
    {
      id: "subtitle",
      type: "text",
      text: "Generate, preview, patch, and export MP4 in the browser.",
      from: 18,
      duration: 132,
      style: {
        position: "absolute",
        left: 148,
        right: 148,
        top: 1015,
        fontSize: 42,
        lineHeight: 1.2,
        color: "#475569",
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
        {
          kind: "keyframes",
          property: "transform",
          frames: [
            { frame: 0, value: "translate(0px, 30px)" },
            { frame: 16, value: "translate(0px, 0px)", easing: "easeOut" },
          ],
        },
      ],
      children: [],
    },
    {
      id: "cta-pill",
      type: "text",
      text: "Export MP4",
      from: 34,
      duration: 116,
      style: {
        position: "absolute",
        left: 360,
        right: 360,
        top: 1178,
        fontSize: 38,
        fontWeight: 850,
        color: "#ffffff",
        textAlign: "center",
        textBackgroundColor: "#e11d48",
        textBackgroundPaddingX: 38,
        textBackgroundPaddingY: 20,
        textBackgroundRadius: 30,
      },
      animations: [
        {
          kind: "keyframes",
          property: "opacity",
          frames: [
            { frame: 0, value: 0 },
            { frame: 10, value: 1, easing: "easeOut" },
          ],
        },
      ],
      children: [],
    },
  ],
};

export const promptChips = [
  "Make a 5 second vertical product launch teaser for a new AI video app.",
  "Create a kinetic typography scene saying SHIP THE DEMO with punchy motion.",
  "Turn this into a calm founder update with a clean title and three points.",
  "Make the title bigger and add a spring pop-in animation.",
  "Change the color palette to bold coral and teal.",
  "Add TikTok-style caption text near the bottom.",
];
