import {
  captionTemplateEntries,
  clipLayoutEntries,
  mediaLookEntries,
  textOverlayTemplateEntries,
  transitionTemplateEntries,
} from "@motionforge/presets";

export type PresetFamily =
  | "subtitles"
  | "text"
  | "media"
  | "layout"
  | "transition";

export type PresetCatalogItem = {
  family: PresetFamily;
  key: string;
  name: string;
  category: string;
  description: string;
  snippet: string;
};

export const presetFamilyLabels: Record<PresetFamily, string> = {
  subtitles: "Subtitles",
  text: "Text",
  media: "Media Looks",
  layout: "Clip Layouts",
  transition: "Transitions",
};

export const presetCatalog: PresetCatalogItem[] = [
  ...captionTemplateEntries.map(([key, preset]) => ({
    family: "subtitles" as const,
    key,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    snippet: `import { styledCaptions } from "@motionforge/presets";

scene.nodes.push(
  styledCaptions(words, {
    fps: scene.fps,
    template: "${key}",
  }),
);`,
  })),
  ...textOverlayTemplateEntries.map(([key, preset]) => ({
    family: "text" as const,
    key,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    snippet: textOverlaySnippet(key, preset.required),
  })),
  ...mediaLookEntries.map(([key, preset]) => ({
    family: "media" as const,
    key,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    snippet: `import { mediaLook } from "@motionforge/presets";

videoClip(clip, {
  style: {
    ...mediaLook("${key}"),
  },
});`,
  })),
  ...clipLayoutEntries.map(([key, preset]) => ({
    family: "layout" as const,
    key,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    snippet: `import { clipLayout } from "@motionforge/presets";

videoClip(clip, {
  style: {
    ...clipLayout("${key}"),
  },
});`,
  })),
  ...transitionTemplateEntries.map(([key, preset]) => ({
    family: "transition" as const,
    key,
    name: preset.name,
    category: preset.category,
    description: preset.description,
    snippet: `import { transitionOverlay } from "@motionforge/presets";

scene.nodes.push(
  transitionOverlay("${key}", {
    at: 90,
    duration: 18,
  }),
);`,
  })),
];

function textOverlaySnippet(key: string, required: readonly string[]): string {
  const slots = required.map((slot) => {
    if (slot === "body") {
      return `    body: "The scene is data.",`;
    }

    if (slot === "value") {
      return `    value: "4.8x",`;
    }

    return `    ${slot}: "MotionForge",`;
  });

  return `import { textOverlay } from "@motionforge/presets";

scene.nodes.push(
  textOverlay({
    template: "${key}",
${slots.join("\n")}
    from: 30,
    duration: 120,
  }),
);`;
}
