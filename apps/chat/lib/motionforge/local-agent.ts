import type { Scene, SceneOp, ScenePatch } from "@motionforge/schema";
import { applyScenePatch, parseScene, validateScene } from "@motionforge/schema";

export type MotionforgeAgentResult = {
  mode: "scene" | "patch";
  scene: Scene;
  patch?: ScenePatch;
  summary: string;
  source: "local" | "model";
  diagnostics: string[];
};

type Theme = {
  background: string;
  panel: string;
  title: string;
  body: string;
  accent: string;
  accent2: string;
};

const themes = {
  bright: {
    background:
      "linear-gradient(180deg, #f8fafc 0%, #d9f4f2 46%, #ffe4e6 100%)",
    panel: "rgba(255,255,255,0.84)",
    title: "#111827",
    body: "#475569",
    accent: "#0f766e",
    accent2: "#e11d48",
  },
  launch: {
    background:
      "linear-gradient(180deg, #0f172a 0%, #0f766e 54%, #f43f5e 100%)",
    panel: "rgba(15,23,42,0.54)",
    title: "#ffffff",
    body: "#d9f4f2",
    accent: "#5eead4",
    accent2: "#fb7185",
  },
  calm: {
    background:
      "linear-gradient(180deg, #f6f7fb 0%, #dcecff 50%, #e7f8ef 100%)",
    panel: "rgba(255,255,255,0.86)",
    title: "#18212f",
    body: "#526071",
    accent: "#2563eb",
    accent2: "#16a34a",
  },
  punch: {
    background:
      "linear-gradient(180deg, #18181b 0%, #4c1d95 42%, #fb7185 100%)",
    panel: "rgba(24,24,27,0.56)",
    title: "#ffffff",
    body: "#f5d0fe",
    accent: "#facc15",
    accent2: "#22d3ee",
  },
} satisfies Record<"bright" | "launch" | "calm" | "punch", Theme>;

export function createSceneFromInstruction(instruction: string): Scene {
  const normalized = instruction.toLowerCase();
  const theme = selectTheme(normalized);
  const title = titleFromInstruction(instruction);
  const subtitle = subtitleFromInstruction(instruction);
  const isLandscape = normalized.includes("landscape") || normalized.includes("youtube");
  const width = isLandscape ? 1280 : 1080;
  const height = isLandscape ? 720 : 1920;
  const duration = normalized.includes("3 second") ? 90 : normalized.includes("6 second") ? 180 : 150;
  const titleTop = isLandscape ? 220 : 704;
  const panelTop = isLandscape ? 132 : 492;
  const panelHeight = isLandscape ? 420 : 790;
  const titleSize = isLandscape ? 58 : title.length > 28 ? 72 : 86;

  return parseScene({
    schemaVersion: 0,
    width,
    height,
    fps: 30,
    duration,
    assets: {},
    nodes: [
      {
        id: "bg",
        type: "div",
        from: 0,
        duration,
        style: {
          width: "100%",
          height: "100%",
          background: theme.background,
        },
      },
      {
        id: "accent-panel",
        type: "div",
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.07),
          right: Math.round(width * 0.07),
          top: panelTop,
          height: panelHeight,
          backgroundColor: theme.panel,
          border: "2px solid rgba(255,255,255,0.22)",
          borderRadius: isLandscape ? 34 : 48,
          boxShadow: "0 30px 76px rgba(15,23,42,0.24)",
        },
        animations: [
          keyframes("opacity", [
            [0, 0],
            [16, 1, "easeOut"],
          ]),
          keyframes("transform", [
            [0, "translate(0px, 48px) scale(0.96)"],
            [20, "translate(0px, 0px) scale(1)", "spring(0.2)"],
          ]),
        ],
      },
      {
        id: "eyebrow",
        type: "text",
        text: "MOTIONFORGE",
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.1),
          right: Math.round(width * 0.1),
          top: isLandscape ? 180 : 625,
          fontSize: isLandscape ? 24 : 34,
          fontWeight: 850,
          letterSpacing: isLandscape ? 6 : 8,
          color: theme.accent,
          textAlign: "center",
        },
        animations: [
          keyframes("opacity", [
            [0, 0],
            [14, 1, "easeOut"],
          ]),
        ],
      },
      {
        id: "title",
        type: "text",
        text: title,
        from: 0,
        duration,
        style: {
          position: "absolute",
          left: Math.round(width * 0.11),
          right: Math.round(width * 0.11),
          top: titleTop,
          fontSize: titleSize,
          fontWeight: 900,
          lineHeight: 1.04,
          color: theme.title,
          textAlign: "center",
        },
        animations: [
          keyframes("opacity", [
            [0, 0],
            [12, 1, "easeOut"],
          ]),
          keyframes("transform", [
            [0, "scale(0.84)"],
            [22, "scale(1)", "spring(0.34)"],
          ]),
        ],
      },
      {
        id: "subtitle",
        type: "text",
        text: subtitle,
        from: 18,
        duration: duration - 18,
        style: {
          position: "absolute",
          left: Math.round(width * 0.13),
          right: Math.round(width * 0.13),
          top: isLandscape ? 390 : 1010,
          fontSize: isLandscape ? 28 : 42,
          lineHeight: 1.18,
          color: theme.body,
          textAlign: "center",
        },
        animations: [
          keyframes("opacity", [
            [0, 0],
            [16, 1, "easeOut"],
          ]),
          keyframes("transform", [
            [0, "translate(0px, 30px)"],
            [16, "translate(0px, 0px)", "easeOut"],
          ]),
        ],
      },
      {
        id: "caption",
        type: "text",
        text: normalized.includes("caption")
          ? "Words land right on the beat"
          : "Preview now. Export when ready.",
        from: 38,
        duration: duration - 38,
        style: {
          position: "absolute",
          left: Math.round(width * 0.18),
          right: Math.round(width * 0.18),
          top: isLandscape ? 535 : 1190,
          fontSize: isLandscape ? 30 : 40,
          fontWeight: 850,
          color: "#ffffff",
          textAlign: "center",
          textStroke: "5px rgba(15,23,42,0.62)",
          textBackgroundColor: theme.accent2,
          textBackgroundPaddingX: isLandscape ? 24 : 38,
          textBackgroundPaddingY: isLandscape ? 13 : 20,
          textBackgroundRadius: 28,
        },
        animations: [
          keyframes("opacity", [
            [0, 0],
            [10, 1, "easeOut"],
          ]),
          keyframes("transform", [
            [0, "scale(0.88)"],
            [16, "scale(1)", "spring(0.24)"],
          ]),
        ],
      },
    ],
  });
}

export function createPatchFromInstruction(scene: Scene, instruction: string): ScenePatch {
  const normalized = instruction.toLowerCase();
  const ops: SceneOp[] = [];
  const ids = collectNodeIds(scene);
  const titleId = ids.find((id) => /title/i.test(id)) ?? firstTextId(scene);
  const subtitleId = ids.find((id) => /subtitle|caption/i.test(id)) ?? firstTextId(scene);
  const bgId = ids.find((id) => /bg|background/i.test(id));
  const panelId = ids.find((id) => /panel|card|accent/i.test(id));

  if (normalized.includes("bigger") || normalized.includes("larger") || normalized.includes("huge")) {
    const current = getNodeStyleNumber(scene, titleId, "fontSize", 72);
    if (titleId) {
      ops.push({
        op: "setStyle",
        id: titleId,
        style: { fontSize: Math.min(144, Math.round(current * 1.22)) },
      });
    }
  }

  const quoted = instruction.match(/["“](.+?)["”]/)?.[1];
  if (quoted && titleId && /(title|say|text|headline|write)/i.test(instruction)) {
    ops.push({ op: "setText", id: titleId, text: quoted });
  }

  if (normalized.includes("caption") || normalized.includes("subtitle")) {
    if (subtitleId) {
      ops.push({
        op: "setText",
        id: subtitleId,
        text: quoted ?? "Clean captions, timed for the edit",
      });
      ops.push({
        op: "setStyle",
        id: subtitleId,
        style: {
          top: Math.round(scene.height * 0.76),
          fontSize: Math.round(scene.height * 0.028),
          fontWeight: 900,
          color: "#ffffff",
          textStroke: "6px rgba(0,0,0,0.72)",
          textBackgroundColor: "#e11d48",
          textBackgroundPaddingX: 34,
          textBackgroundPaddingY: 18,
          textBackgroundRadius: 28,
        },
      });
    }
  }

  if (
    normalized.includes("color") ||
    normalized.includes("palette") ||
    normalized.includes("coral") ||
    normalized.includes("teal") ||
    normalized.includes("dark") ||
    normalized.includes("calm")
  ) {
    const theme = selectTheme(normalized);
    if (bgId) {
      ops.push({ op: "setStyle", id: bgId, style: { background: theme.background } });
    }
    if (panelId) {
      ops.push({ op: "setStyle", id: panelId, style: { backgroundColor: theme.panel } });
    }
    if (titleId) {
      ops.push({ op: "setStyle", id: titleId, style: { color: theme.title } });
    }
    if (subtitleId) {
      ops.push({ op: "setStyle", id: subtitleId, style: { color: theme.body } });
    }
  }

  if (
    normalized.includes("animate") ||
    normalized.includes("motion") ||
    normalized.includes("pop") ||
    normalized.includes("spring")
  ) {
    if (titleId) {
      ops.push({
        op: "setAnimations",
        id: titleId,
        animations: [
          keyframes("opacity", [
            [0, 0],
            [10, 1, "easeOut"],
          ]),
          keyframes("transform", [
            [0, "translate(0px, 46px) scale(0.78)"],
            [18, "translate(0px, 0px) scale(1.08)", "spring(0.42)"],
            [28, "translate(0px, 0px) scale(1)", "easeOut"],
          ]),
        ],
      });
    }
  }

  if (normalized.includes("faster") || normalized.includes("shorter")) {
    ops.push({
      op: "setSceneMeta",
      duration: Math.max(75, Math.round(scene.duration * 0.75)),
    });
  } else if (normalized.includes("slower") || normalized.includes("longer")) {
    ops.push({
      op: "setSceneMeta",
      duration: Math.min(300, Math.round(scene.duration * 1.25)),
    });
  }

  if (ops.length === 0 && titleId) {
    ops.push({
      op: "setText",
      id: titleId,
      text: titleFromInstruction(instruction),
    });
  }

  return ops;
}

export function applyInstructionLocally(
  currentScene: Scene | null,
  instruction: string,
): MotionforgeAgentResult {
  if (!currentScene) {
    const scene = createSceneFromInstruction(instruction);
    return {
      mode: "scene",
      scene,
      summary: "Created a new deterministic scene locally.",
      source: "local",
      diagnostics: [],
    };
  }

  const patch = createPatchFromInstruction(currentScene, instruction);
  const result = applyScenePatch(currentScene, patch);

  if (!result.ok) {
    return {
      mode: "patch",
      scene: currentScene,
      patch,
      summary: "The local patch did not apply.",
      source: "local",
      diagnostics: result.errors.map((error) => error.message),
    };
  }

  return {
    mode: "patch",
    scene: result.scene,
    patch,
    summary: `Applied ${patch.length} local edit${patch.length === 1 ? "" : "s"}.`,
    source: "local",
    diagnostics: [],
  };
}

export function normalizeModelOutput(
  raw: unknown,
  currentScene: Scene | null,
): Omit<MotionforgeAgentResult, "source"> {
  const payload = unwrapModelPayload(raw);

  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const object = payload as {
      scene?: unknown;
      patch?: unknown;
      ops?: unknown;
      summary?: unknown;
    };

    if (object.scene !== undefined) {
      const sceneResult = validateScene(object.scene);
      if (!sceneResult.ok) {
        throw new Error(sceneResult.errors.join("\n"));
      }

      return {
        mode: "scene",
        scene: sceneResult.scene,
        summary:
          typeof object.summary === "string"
            ? object.summary
            : "Generated a new scene.",
        diagnostics: [],
      };
    }

    const patchInput = object.patch ?? object.ops;

    if (patchInput !== undefined) {
      return applyPatchOutput(currentScene, patchInput, object.summary);
    }
  }

  if (Array.isArray(payload)) {
    return applyPatchOutput(currentScene, payload, undefined);
  }

  const sceneResult = validateScene(payload);

  if (sceneResult.ok) {
    return {
      mode: "scene",
      scene: sceneResult.scene,
      summary: "Generated a new scene.",
      diagnostics: [],
    };
  }

  throw new Error("Model output was neither a valid scene nor a valid patch.");
}

export function extractJsonFromText(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.search(/[\[{]/);

  if (start === -1) {
    throw new Error("No JSON object or array found in model output.");
  }

  const sliced = candidate.slice(start);
  const end = Math.max(sliced.lastIndexOf("}"), sliced.lastIndexOf("]"));

  if (end === -1) {
    throw new Error("JSON output appears incomplete.");
  }

  return JSON.parse(sliced.slice(0, end + 1));
}

function applyPatchOutput(
  currentScene: Scene | null,
  patchInput: unknown,
  summary: unknown,
): Omit<MotionforgeAgentResult, "source"> {
  if (!currentScene) {
    throw new Error("The model returned patch ops, but there is no scene yet.");
  }

  const result = applyScenePatch(currentScene, patchInput);

  if (!result.ok) {
    throw new Error(result.errors.map((error) => error.message).join("\n"));
  }

  return {
    mode: "patch",
    scene: result.scene,
    patch: patchInput as ScenePatch,
    summary:
      typeof summary === "string"
        ? summary
        : `Applied ${(patchInput as unknown[]).length} patch ops.`,
    diagnostics: [],
  };
}

function unwrapModelPayload(raw: unknown): unknown {
  if (typeof raw === "string") {
    return extractJsonFromText(raw);
  }

  return raw;
}

function titleFromInstruction(instruction: string): string {
  const quoted = instruction.match(/["“](.+?)["”]/)?.[1];

  if (quoted && quoted.length <= 72) {
    return quoted;
  }

  const cleaned = instruction
    .replace(/^make\s+/i, "")
    .replace(/^create\s+/i, "")
    .replace(/\b(a|an|the)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "Prompt to polished video";
  }

  const words = cleaned.split(" ").slice(0, 8).join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function subtitleFromInstruction(instruction: string): string {
  const normalized = instruction.toLowerCase();

  if (normalized.includes("product") || normalized.includes("launch")) {
    return "A fast, polished launch card with motion and a clear call to action.";
  }

  if (normalized.includes("founder") || normalized.includes("update")) {
    return "Three crisp beats, calm pacing, and a title that feels intentional.";
  }

  if (normalized.includes("caption") || normalized.includes("tiktok")) {
    return "Caption-first layout with punchy text treatment near the bottom.";
  }

  return "A serializable scene document, previewed and exported through one render path.";
}

function selectTheme(instruction: string): Theme {
  if (instruction.includes("dark") || instruction.includes("punch") || instruction.includes("kinetic")) {
    return themes.punch;
  }

  if (instruction.includes("calm") || instruction.includes("founder") || instruction.includes("clean")) {
    return themes.calm;
  }

  if (instruction.includes("launch") || instruction.includes("bold") || instruction.includes("coral")) {
    return themes.launch;
  }

  return themes.bright;
}

function collectNodeIds(scene: Scene): string[] {
  const ids: string[] = [];
  const visit = (nodes: Scene["nodes"]) => {
    for (const node of nodes) {
      ids.push(node.id);
      visit(node.children ?? []);
    }
  };
  visit(scene.nodes);
  return ids;
}

function firstTextId(scene: Scene): string | undefined {
  const stack = [...scene.nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) {
      continue;
    }
    if (node.type === "text") {
      return node.id;
    }
    stack.push(...(node.children ?? []));
  }

  return undefined;
}

function getNodeStyleNumber(
  scene: Scene,
  id: string | undefined,
  key: string,
  fallback: number,
): number {
  if (!id) {
    return fallback;
  }

  const stack = [...scene.nodes];

  while (stack.length > 0) {
    const node = stack.shift();
    if (!node) {
      continue;
    }

    if (node.id === id) {
      const value = (node.style as Record<string, unknown> | undefined)?.[key];
      return typeof value === "number" ? value : fallback;
    }

    stack.push(...(node.children ?? []));
  }

  return fallback;
}

type KeyframeTuple = [number, string | number, string?];

function keyframes(property: string, frames: KeyframeTuple[]) {
  return {
    kind: "keyframes" as const,
    property,
    frames: frames.map(([frame, value, easing]) => ({
      frame,
      value,
      ...(easing ? { easing } : {}),
    })),
  };
}
