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
  "Add a long title overlay that stays inside the safe area.",
  "Add minimal bar subtitles from this transcript.",
  "Use spotlight word-timed captions for the voiceover.",
  "Put @Logo in the top-right corner as a logo bug.",
  "Add a subtle @Logo watermark in the bottom-right corner.",
  "Place @Sticker as a playful sticker in the top-left corner.",
  "Place @Product Image in the center as a product shot.",
  "Put @Video 1 in the top-right as picture-in-picture.",
  "Add @Video 2 as a muted b-roll strip near the bottom.",
  "Use @Screen Recording as a centered screen demo overlay.",
  "Add @Audio 1 as quiet background music with a 1s fade in and 1s fade out.",
  "Put @Voiceover at 1s as a voiceover track.",
  "Play @Ping at 3s as a notification ping.",
  "Make the title bigger and add a spring pop-in animation.",
  "Change the color palette to bold coral and teal.",
  "Add TikTok-style caption text near the bottom.",
  "Show a subtitle template gallery previewing all caption styles.",
  "Add neon karaoke subtitles with active word highlights.",
  "Use terminal-style subtitles for the caption track.",
];
