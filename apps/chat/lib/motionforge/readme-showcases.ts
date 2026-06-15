import { parseScene, type Scene } from "@motionforge/schema";
import animatedChart from "../../../../verification/edgy-animated-chart.json";
import appPromo from "../../../../verification/edgy-app-promo.json";
import beatEdit from "../../../../verification/edgy-beat-edit.json";
import cinematicTitle from "../../../../verification/edgy-cinematic-title.json";
import kineticTypography from "../../../../verification/edgy-kinetic-typography.json";
import multicam from "../../../../verification/edgy-multicam.json";

export type ReadmeShowcaseExample = {
  id: string;
  title: string;
  description: string;
  jsonPath: string;
  videoPath: string;
  posterPath: string;
  posterFrame: number;
  scene: Scene;
};

export const readmeShowcaseExamples: ReadmeShowcaseExample[] = [
  {
    id: "edgy-kinetic-typography",
    title: "Kinetic Typography",
    description:
      "Words slam in with spring scale, previous words dim into a stacked trail, and an accent light sweeps across.",
    jsonPath: "verification/edgy-kinetic-typography.json",
    videoPath: "verification/edgy-kinetic-typography.mp4",
    posterPath: "verification/edgy-kinetic-typography-f75.png",
    posterFrame: 75,
    scene: parseScene(kineticTypography),
  },
  {
    id: "edgy-app-promo",
    title: "App Promo",
    description:
      "A phone mockup, clipped app screens, layered notch, and staggered feature bullets.",
    jsonPath: "verification/edgy-app-promo.json",
    videoPath: "verification/edgy-app-promo.mp4",
    posterPath: "verification/edgy-app-promo-f80.png",
    posterFrame: 80,
    scene: parseScene(appPromo),
  },
  {
    id: "edgy-animated-chart",
    title: "Animated Chart",
    description:
      "Agent-generated data-viz with bars growing through eased layout keyframes.",
    jsonPath: "verification/edgy-animated-chart.json",
    videoPath: "verification/edgy-animated-chart.mp4",
    posterPath: "verification/edgy-animated-chart-f130.png",
    posterFrame: 130,
    scene: parseScene(animatedChart),
  },
  {
    id: "edgy-beat-edit",
    title: "Beat Edit",
    description:
      "Synth drums, photo punches, snare flashes, Lottie stars, word slams, and color grade shifts.",
    jsonPath: "verification/edgy-beat-edit.json",
    videoPath: "verification/edgy-beat-edit.mp4",
    posterPath: "verification/edgy-beat-edit-f61.png",
    posterFrame: 61,
    scene: parseScene(beatEdit),
  },
  {
    id: "edgy-cinematic-title",
    title: "Cinematic Title",
    description:
      "A widescreen film card with graded footage, vignette, letterbox bars, and animated title tracking.",
    jsonPath: "verification/edgy-cinematic-title.json",
    videoPath: "verification/edgy-cinematic-title.mp4",
    posterPath: "verification/edgy-cinematic-title-f150.png",
    posterFrame: 150,
    scene: parseScene(cinematicTitle),
  },
  {
    id: "edgy-multicam",
    title: "Multicam Layout",
    description:
      "Four simultaneous video decoders in a grid, with one camera animating to fullscreen.",
    jsonPath: "verification/edgy-multicam.json",
    videoPath: "verification/edgy-multicam.mp4",
    posterPath: "verification/edgy-multicam-f100.png",
    posterFrame: 100,
    scene: parseScene(multicam),
  },
];

export function cloneReadmeShowcaseScene(
  example: ReadmeShowcaseExample,
): Scene {
  return parseScene(JSON.parse(JSON.stringify(example.scene)) as unknown);
}
