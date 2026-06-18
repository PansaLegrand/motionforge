import {
  clipLayout,
  captionTemplateEntries,
  clipLayoutEntries,
  mediaLook,
  mediaLookEntries,
  textOverlay,
  textOverlayTemplateEntries,
  transitionOverlay,
  transitionTemplateEntries,
  type ClipLayoutKey,
  type MediaLookKey,
  type TextOverlaySlot,
  type TextOverlayTemplateKey,
  type TransitionTemplateKey,
} from "@motionforge/presets";
import {
  validateScene,
  type Scene,
  type SceneNode,
  type ScenePatch,
  type SceneStyle,
} from "@motionforge/schema";

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

export type PresetPatchExample =
  | {
      ok: true;
      title: string;
      description: string;
      patch: ScenePatch;
    }
  | {
      ok: false;
      title: string;
      reason: string;
    };

type TextOverlaySlotValues = Pick<
  Parameters<typeof textOverlay>[0],
  "title" | "body" | "value" | "label" | "subtitle" | "attribution" | "kicker"
>;

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

export function buildPresetPatchExample(
  item: PresetCatalogItem,
  sceneInput: unknown,
): PresetPatchExample {
  const parsed = validateScene(sceneInput);

  if (!parsed.ok) {
    return {
      ok: false,
      title: "Patch unavailable",
      reason: "The current scene must be valid before a preset patch can be generated.",
    };
  }

  switch (item.family) {
    case "media":
      return buildMediaStylePatch(
        item,
        parsed.scene,
        mediaLook(item.key as MediaLookKey),
      );

    case "layout":
      return buildMediaStylePatch(
        item,
        parsed.scene,
        clipLayout(item.key as ClipLayoutKey),
      );

    case "text":
      return buildTextInsertPatch(item, parsed.scene);

    case "transition":
      return buildTransitionInsertPatch(item, parsed.scene);

    case "subtitles":
      return {
        ok: false,
        title: "Patch unavailable",
        reason:
          "Subtitle presets need word-level transcript timing data. Copy the TypeScript snippet and pass ASR words to styledCaptions().",
      };
  }
}

function buildMediaStylePatch(
  item: PresetCatalogItem,
  scene: Scene,
  style: SceneStyle,
): PresetPatchExample {
  const target = findFirstNode(scene.nodes, (node) =>
    node.type === "img" || node.type === "video",
  );

  if (!target) {
    return {
      ok: false,
      title: "Patch unavailable",
      reason:
        "The current scene does not contain an image or video node to style.",
    };
  }

  return {
    ok: true,
    title: `${item.name} patch`,
    description: `Applies ${item.key} to ${target.id}.`,
    patch: [{ op: "setStyle", id: target.id, style }],
  };
}

function buildTextInsertPatch(
  item: PresetCatalogItem,
  scene: Scene,
): PresetPatchExample {
  const template = item.key as TextOverlayTemplateKey;
  const required = textOverlayTemplateEntries.find(
    ([key]) => key === template,
  )?.[1].required;

  if (!required) {
    return {
      ok: false,
      title: "Patch unavailable",
      reason: `Unknown text overlay template "${item.key}".`,
    };
  }

  const node = textOverlay({
    template,
    id: uniqueNodeId(scene, `${item.key}-overlay`),
    ...sampleTextSlots(required),
    from: recommendedOverlayStart(scene),
    duration: recommendedOverlayDuration(scene),
  });

  return {
    ok: true,
    title: `${item.name} patch`,
    description: `Inserts a ${item.key} overlay at the scene root.`,
    patch: [{ op: "insertNode", node }],
  };
}

function buildTransitionInsertPatch(
  item: PresetCatalogItem,
  scene: Scene,
): PresetPatchExample {
  const duration = Math.min(18, scene.duration);
  const at = Math.max(
    0,
    Math.min(scene.duration - duration, Math.round(scene.duration / 2)),
  );
  const node = transitionOverlay(item.key as TransitionTemplateKey, {
    id: uniqueNodeId(scene, `${item.key}-transition`),
    at,
    duration,
  });

  return {
    ok: true,
    title: `${item.name} patch`,
    description: `Inserts a ${item.key} transition at frame ${at}.`,
    patch: [{ op: "insertNode", node }],
  };
}

function sampleTextSlots(
  required: readonly TextOverlaySlot[],
): TextOverlaySlotValues {
  const slots: TextOverlaySlotValues = {};

  for (const slot of required) {
    if (slot === "body") {
      slots.body = "The scene is data.";
    } else if (slot === "value") {
      slots.value = "4.8x";
    } else if (slot === "label") {
      slots.label = "faster iteration";
    } else {
      slots[slot] = "MotionForge";
    }
  }

  return slots;
}

function recommendedOverlayStart(scene: Scene): number {
  return Math.min(30, Math.max(0, scene.duration - 1));
}

function recommendedOverlayDuration(scene: Scene): number {
  return Math.max(1, Math.min(120, scene.duration));
}

function uniqueNodeId(scene: Scene, preferred: string): string {
  const ids = new Set<string>();
  collectNodeIds(scene.nodes, ids);

  if (!ids.has(preferred)) {
    return preferred;
  }

  for (let index = 2; ; index += 1) {
    const candidate = `${preferred}-${index}`;

    if (!ids.has(candidate)) {
      return candidate;
    }
  }
}

function collectNodeIds(nodes: readonly SceneNode[], into: Set<string>): void {
  for (const node of nodes) {
    into.add(node.id);
    collectNodeIds(node.children ?? [], into);
  }
}

function findFirstNode(
  nodes: readonly SceneNode[],
  predicate: (node: SceneNode) => boolean,
): SceneNode | undefined {
  for (const node of nodes) {
    if (predicate(node)) {
      return node;
    }

    const child = findFirstNode(node.children ?? [], predicate);

    if (child) {
      return child;
    }
  }

  return undefined;
}
