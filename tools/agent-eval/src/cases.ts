import type { Scene } from "@motionforge/schema";

/**
 * Eval cases per RFC 0001. Scoring is mechanical: the validator/patch API is
 * the judge, plus per-case structural assertions. An assertion returns a
 * list of failure strings (empty = pass).
 */

export type GenerateCase = {
  id: string;
  suite: "generate";
  /** User-style prompt; the runner prepends llms.txt as the system prompt. */
  prompt: string;
  assert: (scene: Scene) => string[];
};

export type EditCase = {
  id: string;
  suite: "edit";
  scene: Scene;
  /** Edit instruction; the model must answer with a patch op list. */
  prompt: string;
  assert: (before: Scene, after: Scene) => string[];
};

export type EvalCase = GenerateCase | EditCase;

// ---------------------------------------------------------------------------

function findText(scene: Scene, includes: string) {
  const all: Array<{ id: string; text?: string }> = [];
  const visit = (nodes: Scene["nodes"]) => {
    for (const node of nodes) {
      all.push(node);
      visit(node.children ?? []);
    }
  };
  visit(scene.nodes);
  return all.find(
    (n) => n.text && n.text.toLowerCase().includes(includes.toLowerCase()),
  );
}

const editBase: Scene = {
  schemaVersion: 0,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 120,
  assets: {},
  nodes: [
    {
      id: "bg",
      type: "div",
      from: 0,
      duration: 120,
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
      animations: [],
      children: [],
    },
    {
      id: "title",
      type: "text",
      text: "Summer Sale",
      from: 0,
      duration: 120,
      style: {
        position: "absolute",
        left: 64,
        right: 64,
        top: 700,
        fontSize: 64,
        color: "#ffffff",
        textAlign: "center",
      },
      animations: [],
      children: [],
    },
    {
      id: "subtitle",
      type: "text",
      text: "Up to 50% off",
      from: 30,
      duration: 90,
      style: {
        position: "absolute",
        left: 64,
        right: 64,
        top: 820,
        fontSize: 36,
        color: "#ffd166",
        textAlign: "center",
      },
      animations: [],
      children: [],
    },
  ],
} as Scene;

export const cases: EvalCase[] = [
  {
    id: "gen-minimal-title",
    suite: "generate",
    prompt:
      'Create a 3-second 1080x1920 30fps scene: dark background, centered white text "HELLO WORLD" that fades in over the first 12 frames.',
    assert: (scene) => {
      const failures: string[] = [];
      if (scene.duration !== 90) failures.push(`duration ${scene.duration}, wanted 90`);
      if (scene.width !== 1080 || scene.height !== 1920) failures.push("wrong canvas size");
      const text = findText(scene, "hello world");
      if (!text) failures.push('no text node containing "HELLO WORLD"');
      return failures;
    },
  },
  {
    id: "gen-two-scenes-sequence",
    suite: "generate",
    prompt:
      "Create a 6-second 1280x720 30fps scene with two full-screen colored sections shown one after the other: a red div for the first 3 seconds, then a blue div for the last 3 seconds.",
    assert: (scene) => {
      const failures: string[] = [];
      if (scene.duration !== 180) failures.push(`duration ${scene.duration}, wanted 180`);
      const starts = scene.nodes.map((n) => n.from ?? 0);
      if (!starts.includes(90)) failures.push("no node starting at frame 90");
      return failures;
    },
  },
  {
    id: "gen-caption-style",
    suite: "generate",
    prompt:
      'Create a 2-second 1080x1920 30fps scene with a single caption-style text node "LET\'S GO" near the bottom: bold, white fill, black text stroke, and a fitted background pill.',
    assert: (scene) => {
      const failures: string[] = [];
      const text = findText(scene, "go");
      if (!text) return ['no text node containing "GO"'];
      const style = (text as { style?: Record<string, unknown> }).style ?? {};
      if (!style["textStroke"]) failures.push("no textStroke on the caption");
      if (!style["textBackgroundColor"]) failures.push("no textBackgroundColor pill");
      return failures;
    },
  },
  {
    id: "edit-bigger-title",
    suite: "edit",
    scene: editBase,
    prompt: "Make the title text twice as big.",
    assert: (before, after) => {
      const failures: string[] = [];
      const title = after.nodes.find((n) => n.id === "title");
      const fontSize = title?.style?.fontSize;
      if (fontSize !== 128) failures.push(`title fontSize ${String(fontSize)}, wanted 128`);
      const subtitle = after.nodes.find((n) => n.id === "subtitle");
      if (JSON.stringify(subtitle) !== JSON.stringify(before.nodes.find((n) => n.id === "subtitle"))) {
        failures.push("subtitle changed — untouched nodes must stay identical");
      }
      return failures;
    },
  },
  {
    id: "edit-retime-subtitle",
    suite: "edit",
    scene: editBase,
    prompt: "Show the subtitle from the very beginning instead of frame 30, keeping its end where it is.",
    assert: (_before, after) => {
      const failures: string[] = [];
      const subtitle = after.nodes.find((n) => n.id === "subtitle");
      if ((subtitle?.from ?? -1) !== 0) failures.push(`subtitle.from ${subtitle?.from}, wanted 0`);
      if ((subtitle?.duration ?? -1) !== 120) failures.push(`subtitle.duration ${subtitle?.duration}, wanted 120`);
      return failures;
    },
  },
  {
    id: "edit-pop-in-animation",
    suite: "edit",
    scene: editBase,
    prompt:
      "Give the title a pop-in entrance: scale from 0.8 to 1 with a spring easing over the first 12 frames, and fade its opacity from 0 to 1 over the same frames.",
    assert: (_before, after) => {
      const failures: string[] = [];
      const title = after.nodes.find((n) => n.id === "title");
      const animations = title?.animations ?? [];
      const props = animations.map((a) => a.property);
      if (!props.includes("transform")) failures.push("no transform animation on title");
      if (!props.includes("opacity")) failures.push("no opacity animation on title");
      return failures;
    },
  },
  {
    id: "edit-remove-subtitle",
    suite: "edit",
    scene: editBase,
    prompt: "Remove the subtitle entirely.",
    assert: (_before, after) => {
      const failures: string[] = [];
      if (after.nodes.some((n) => n.id === "subtitle")) failures.push("subtitle still present");
      if (!after.nodes.some((n) => n.id === "title")) failures.push("title was removed too");
      return failures;
    },
  },
];
