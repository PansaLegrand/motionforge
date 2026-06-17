// Writes preset-gallery scene JSON used by docs thumbnails.
// Run after `pnpm build`:
//   node examples/generate-preset-gallery.mjs
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateScene } from "../packages/schema/dist/index.js";
import {
  captionTemplateEntries,
  clipLayout,
  clipLayoutEntries,
  mediaLook,
  mediaLookEntries,
  styledCaptions,
  textOverlay,
  textOverlayTemplateEntries,
  transitionOverlay,
} from "../packages/presets/dist/index.js";

const outDir = resolve("examples/generated/presets");
await mkdir(outDir, { recursive: true });

const scenes = [
  subtitleGalleryScene(),
  textOverlayGalleryScene(),
  mediaLookGalleryScene(),
  clipLayoutGalleryScene(),
  transitionGalleryScene(),
];

for (const scene of scenes) {
  const result = validateScene(scene.scene);

  if (!result.ok) {
    console.error(`${scene.id}: ${result.errors.join("\n")}`);
    process.exitCode = 1;
    continue;
  }

  const outPath = resolve(outDir, `${scene.id}.json`);
  await writeFile(outPath, `${JSON.stringify(scene.scene, null, 2)}\n`);
  console.log(`wrote ${outPath}`);
}

function baseScene(id, title, nodes, options = {}) {
  return {
    id,
    scene: {
      schemaVersion: 0,
      width: options.width ?? 1600,
      height: options.height ?? 900,
      fps: 30,
      duration: 120,
      assets: {},
      nodes: [
        {
          id: "background",
          type: "div",
          style: {
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(135deg, #171717 0%, #222426 52%, #1f1b18 100%)",
          },
        },
        {
          id: "gallery-title",
          type: "text",
          text: title,
          style: {
            position: "absolute",
            left: 64,
            top: 42,
            width: 760,
            height: 54,
            fontFamily: "Inter, system-ui, Arial, sans-serif",
            fontSize: 38,
            fontWeight: 900,
            color: "#ffffff",
            textAlign: "left",
          },
        },
        ...nodes,
      ],
    },
  };
}

function subtitleGalleryScene() {
  const words = [
    { word: "STYLE", startMs: 0, endMs: 1000 },
    { word: "FAST", startMs: 1000, endMs: 2200 },
  ];

  return baseScene(
    "preset-subtitles",
    "Subtitle Templates",
    captionTemplateEntries.map(([template], index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = 64 + col * 382;
      const y = 132 + row * 184;
      const captions = styledCaptions(words, {
        fps: 30,
        template,
        idPrefix: `sub-${template}`,
        area: { top: 44, height: 94 },
        maxWordsPerSegment: 2,
        style: {
          fontSize: 38,
          letterSpacing: 0,
          textStroke: "2px rgba(2,6,23,0.84)",
          textBackgroundPaddingX: 18,
          textBackgroundPaddingY: 8,
        },
        highlightStyle: {
          textBackgroundPaddingX: 12,
          textBackgroundPaddingY: 4,
          textBackgroundRadius: 8,
        },
      });

      return {
        id: `card-${template}`,
        type: "div",
        style: cardStyle(x, y, 336, 154),
        children: [
          labelNode(`label-${template}`, template, 18, 14),
          ...offsetChildren(captions, 0),
        ],
      };
    }),
  );
}

function textOverlayGalleryScene() {
  const examples = {
    titleCard: {
      title: "Launch Week",
      subtitle: "Built with scene data",
      kicker: "MotionForge",
    },
    lowerThird: {
      title: "Ada Lovelace",
      subtitle: "Programmer",
      kicker: "Interview",
    },
    quoteCard: { body: "The scene is data.", attribution: "MotionForge" },
    statCallout: { value: "4.8x", label: "faster", subtitle: "browser export" },
    announcementBanner: {
      title: "New Drop",
      subtitle: "Friday",
      kicker: "Now Live",
    },
    socialHook: {
      title: "Stop guessing styles",
      subtitle: "Use preset names.",
    },
    chapterTitle: {
      title: "Act Two",
      subtitle: "The build begins",
      kicker: "02",
    },
  };

  return baseScene(
    "preset-text-overlays",
    "Text Overlay Templates",
    textOverlayTemplateEntries.map(([template], index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const width = 342;
      const height = 300;
      const x = 62 + col * 384;
      const y = 140 + row * 340;
      const overlay = textOverlay({
        template,
        id: `overlay-${template}`,
        enter: false,
        accentColor: accent(index),
        style: compactOverlayFrame(width, height, template),
        titleStyle: compactTextStyle(template === "socialHook" ? 26 : 30),
        subtitleStyle: compactTextStyle(16, "rgba(226,232,240,0.86)"),
        bodyStyle: compactTextStyle(25, "#0f172a"),
        valueStyle: compactTextStyle(44, accent(index)),
        labelStyle: compactTextStyle(18),
        attributionStyle: compactTextStyle(14, "#475569"),
        kickerStyle: {
          ...compactTextStyle(
            12,
            template === "announcementBanner"
              ? "rgba(255,255,255,0.86)"
              : accent(index),
          ),
          letterSpacing: 0,
        },
        ...examples[template],
      });

      return {
        id: `card-${template}`,
        type: "div",
        style: cardStyle(x, y, width, height),
        children: [labelNode(`label-${template}`, template, 20, 18), overlay],
      };
    }),
  );
}

function mediaLookGalleryScene() {
  return baseScene(
    "preset-media-looks",
    "Media Looks",
    mediaLookEntries.map(([key], index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = 74 + col * 374;
      const y = 150 + row * 310;

      return {
        id: `look-${key}`,
        type: "div",
        style: cardStyle(x, y, 314, 246),
        children: [
          {
            id: `look-${key}-media`,
            type: "div",
            style: {
              position: "absolute",
              left: 18,
              top: 52,
              width: 278,
              height: 150,
              borderRadius: 8,
              background: mediaGradient(index),
              boxShadow: "0px 12px 34px rgba(0,0,0,0.22)",
              ...mediaLook(key),
            },
          },
          labelNode(`label-${key}`, key, 20, 18),
        ],
      };
    }),
  );
}

function clipLayoutGalleryScene() {
  const selected = clipLayoutEntries.map(([key]) => key);

  return baseScene(
    "preset-clip-layouts",
    "Clip Layouts",
    selected.map((key, index) => {
      const row = Math.floor(index / 4);
      const col = index % 4;
      const x = 74 + col * 374;
      const y = 140 + row * 246;

      return {
        id: `layout-${key}`,
        type: "div",
        style: cardStyle(x, y, 314, 190),
        children: [
          {
            id: `layout-${key}-frame`,
            type: "div",
            style: {
              position: "absolute",
              left: 20,
              top: 50,
              width: 274,
              height: 104,
              borderRadius: 8,
              backgroundColor: "rgba(15,23,42,0.72)",
              overflow: "hidden",
              border: "1px solid rgba(148,163,184,0.32)",
            },
            children: [
              {
                id: `layout-${key}-media`,
                type: "div",
                style: clipLayoutPreviewStyle(key, index),
              },
            ],
          },
          labelNode(`label-${key}`, key, 20, 18),
        ],
      };
    }),
  );
}

function transitionGalleryScene() {
  const transitions = [
    "fade",
    "dipToBlack",
    "flash",
    "wipeLeft",
    "wipeRight",
    "zoom",
  ];

  return baseScene(
    "preset-transitions",
    "Transition Overlays",
    transitions.map((template, index) => {
      const col = index % 3;
      const row = Math.floor(index / 3);
      const x = 102 + col * 494;
      const y = 170 + row * 292;
      const transition = transitionOverlay(template, {
        id: `transition-${template}`,
        at: 0,
        duration: 60,
        color: transitionColor(template),
      });

      return {
        id: `card-${template}`,
        type: "div",
        style: cardStyle(x, y, 410, 220),
        children: [
          {
            id: `transition-${template}-base`,
            type: "div",
            style: {
              position: "absolute",
              left: 22,
              top: 54,
              width: 366,
              height: 124,
              borderRadius: 8,
              background: mediaGradient(index),
              overflow: "hidden",
            },
            children: [
              {
                ...transition,
                style: {
                  ...transition.style,
                  borderRadius: 8,
                },
              },
            ],
          },
          labelNode(`label-${template}`, template, 24, 18),
        ],
      };
    }),
  );
}

function cardStyle(left, top, width, height) {
  return {
    position: "absolute",
    left,
    top,
    width,
    height,
    backgroundColor: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 8,
    boxShadow: "0px 18px 48px rgba(0,0,0,0.24)",
    overflow: "hidden",
  };
}

function labelNode(id, text, left, top) {
  return {
    id,
    type: "text",
    text,
    style: {
      position: "absolute",
      left,
      top,
      width: "80%",
      height: 28,
      fontFamily: "Inter, system-ui, Arial, sans-serif",
      fontSize: 19,
      fontWeight: 900,
      color: "#e2e8f0",
      letterSpacing: 0,
    },
  };
}

function compactOverlayFrame(width, height, template) {
  const tall = template === "quoteCard" || template === "statCallout";

  return {
    position: "absolute",
    left: 18,
    top: 58,
    right: undefined,
    bottom: undefined,
    width: width - 36,
    height: height - 78,
    minHeight: height - 78,
    padding: tall ? 18 : 16,
    gap: 8,
    borderRadius: 8,
  };
}

function compactTextStyle(fontSize, color = "#ffffff") {
  return {
    fontFamily: "Inter, system-ui, Arial, sans-serif",
    fontSize,
    fontWeight: 900,
    lineHeight: 1.04,
    color,
    textAlign: "center",
    textShadow: "0px 6px 20px rgba(0,0,0,0.22)",
  };
}

function offsetChildren(node, top) {
  return [
    {
      ...node,
      style: {
        ...(node.style ?? {}),
        position: "absolute",
        left: 0,
        top,
        width: "100%",
        height: "100%",
      },
    },
  ];
}

function clipLayoutPreviewStyle(key, index) {
  const base = {
    background: mediaGradient(index),
    filter: undefined,
    boxShadow: undefined,
    border: undefined,
    zIndex: undefined,
    borderRadius: 0,
  };

  const overrides = {
    fullscreen: {},
    containCenter: {
      left: 18,
      top: 16,
      width: 238,
      height: 72,
      borderRadius: 8,
    },
    pictureInPicture: {
      left: 174,
      right: undefined,
      top: 18,
      bottom: undefined,
      width: 78,
      height: 72,
      borderRadius: 8,
      border: "2px solid rgba(255,255,255,0.78)",
      boxShadow: "0px 10px 24px rgba(0,0,0,0.28)",
    },
    splitLeft: {},
    splitRight: {
      left: "50%",
      right: undefined,
    },
    gridTopLeft: {},
    gridTopRight: {},
    gridBottomLeft: {},
    gridBottomRight: {},
    blurredBackground: {
      left: -18,
      top: -12,
      width: 310,
      height: 128,
      filter: "brightness(0.72) saturate(1.05) blur(8px)",
    },
    phoneSafeVertical: {
      left: 94,
      top: 0,
      width: 86,
      height: "100%",
      borderRadius: 8,
    },
  };

  return clipLayout(key, {
    ...base,
    ...overrides[key],
  });
}

function transitionColor(template) {
  return {
    fade: "rgba(15,23,42,0.72)",
    dipToBlack: "rgba(0,0,0,1)",
    flash: "rgba(255,255,255,0.92)",
    wipeLeft: "rgba(168,85,247,0.94)",
    wipeRight: "rgba(14,165,233,0.94)",
    zoom: "rgba(245,158,11,0.72)",
  }[template];
}

function accent(index) {
  return [
    "#38bdf8",
    "#f59e0b",
    "#22c55e",
    "#f472b6",
    "#a78bfa",
    "#facc15",
    "#14b8a6",
  ][index % 7];
}

function mediaGradient(index) {
  const gradients = [
    "linear-gradient(135deg, #22d3ee 0%, #2563eb 46%, #111827 100%)",
    "linear-gradient(135deg, #fb7185 0%, #f59e0b 48%, #312e81 100%)",
    "linear-gradient(135deg, #34d399 0%, #0f766e 50%, #0f172a 100%)",
    "linear-gradient(135deg, #f472b6 0%, #7c3aed 52%, #020617 100%)",
  ];

  return gradients[index % gradients.length];
}
