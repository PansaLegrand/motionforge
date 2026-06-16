import { parseScene, type Scene } from "@motionforge/schema";
import { createSceneFromInstruction } from "./local-agent";

export type StarterTemplateExample = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  scene: Scene;
};

const starterTemplatePrompts = [
  {
    id: "vertical-product-launch",
    title: "Product Launch",
    description:
      "A vertical launch card with bold contrast, a central title, and staggered preset motion.",
    prompt:
      "Make a 5 second vertical product launch teaser for a new AI video app.",
  },
  {
    id: "kinetic-typography",
    title: "Kinetic Typography",
    description:
      "Punchy typography with a darker palette, spring title motion, and a caption-style callout.",
    prompt:
      "Create a kinetic typography scene saying SHIP THE DEMO with punchy motion.",
  },
  {
    id: "founder-update",
    title: "Founder Update",
    description:
      "A calm update card for narrative edits, clean typography, and soft entrance timing.",
    prompt:
      "Turn this into a calm founder update with a clean title and three points.",
  },
] satisfies Array<{
  id: string;
  title: string;
  description: string;
  prompt: string;
}>;

export const starterTemplateExamples: StarterTemplateExample[] =
  starterTemplatePrompts.map((template) => ({
    ...template,
    scene: createSceneFromInstruction(template.prompt),
  }));

export function cloneStarterTemplateScene(
  example: StarterTemplateExample,
): Scene {
  return parseScene(JSON.parse(JSON.stringify(example.scene)) as unknown);
}

export const promptChips = [
  "Make a 5 second vertical product launch teaser for a new AI video app.",
  "Create a kinetic typography scene saying SHIP THE DEMO with punchy motion.",
  "Turn this into a calm founder update with a clean title and three points.",
  "Make the title bigger and add a spring pop-in animation.",
  "Change the color palette to bold coral and teal.",
  "Add TikTok-style caption text near the bottom.",
  "Show a subtitle template gallery previewing all caption styles.",
  "Add neon karaoke subtitles with active word highlights.",
  "Use terminal-style subtitles for the caption track.",
];
