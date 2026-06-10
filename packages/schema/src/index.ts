import { z } from "zod";

export const supportedStyleKeys = [
  "display",
  "flexDirection",
  "justifyContent",
  "alignItems",
  "gap",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "padding",
  "margin",
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "inset",
  "background",
  "backgroundColor",
  "borderRadius",
  "opacity",
  "transform",
  "transformOrigin",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "color",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textShadow",
  "objectFit",
  "objectPosition",
] as const;

export type SupportedStyleKey = (typeof supportedStyleKeys)[number];

const lengthValueSchema = z.union([z.number(), z.string()]);

export const styleSchema = z
  .object({
    display: z.literal("flex").optional(),
    flexDirection: z.enum(["row", "column"]).optional(),
    justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between"]).optional(),
    alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
    gap: lengthValueSchema.optional(),
    width: lengthValueSchema.optional(),
    height: lengthValueSchema.optional(),
    minWidth: lengthValueSchema.optional(),
    minHeight: lengthValueSchema.optional(),
    maxWidth: lengthValueSchema.optional(),
    maxHeight: lengthValueSchema.optional(),
    padding: lengthValueSchema.optional(),
    margin: lengthValueSchema.optional(),
    position: z.enum(["relative", "absolute"]).optional(),
    left: lengthValueSchema.optional(),
    right: lengthValueSchema.optional(),
    top: lengthValueSchema.optional(),
    bottom: lengthValueSchema.optional(),
    inset: lengthValueSchema.optional(),
    background: z.string().optional(),
    backgroundColor: z.string().optional(),
    borderRadius: lengthValueSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
    transform: z.string().optional(),
    transformOrigin: z.string().optional(),
    fontFamily: z.string().optional(),
    fontSize: lengthValueSchema.optional(),
    fontWeight: z.union([z.number(), z.string()]).optional(),
    fontStyle: z.enum(["normal", "italic"]).optional(),
    color: z.string().optional(),
    lineHeight: z.union([z.number(), z.string()]).optional(),
    letterSpacing: lengthValueSchema.optional(),
    textAlign: z.enum(["left", "center", "right"]).optional(),
    textShadow: z.string().optional(),
    objectFit: z.enum(["contain", "cover", "fill"]).optional(),
    objectPosition: z.string().optional(),
  })
  .strict({
    message:
      "Unsupported style property. motionforge v0 supports a curated CSS-like subset; move unsupported behavior into supported transforms, layout, or custom draw nodes.",
  });

export type SceneStyle = z.infer<typeof styleSchema>;

export const keyframeSchema = z.object({
  frame: z.number().int().nonnegative(),
  value: z.union([z.number(), z.string()]),
  easing: z.enum(["linear", "easeIn", "easeOut", "easeInOut"]).optional(),
});

export const animationSchema = z.object({
  kind: z.literal("keyframes"),
  property: z.string().min(1),
  frames: z.array(keyframeSchema).min(1),
});

export type SceneAnimation = z.infer<typeof animationSchema>;

export const assetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["image", "video", "audio", "font"]),
  src: z.string().min(1),
});

export type SceneAsset = z.infer<typeof assetSchema>;

type SceneNodeInput = {
  id: string;
  type: "div" | "text" | "img" | "video";
  text?: string;
  assetId?: string;
  from?: number;
  duration?: number;
  style?: SceneStyle;
  animations?: SceneAnimation[];
  children?: SceneNodeInput[];
};

export type SceneNode = SceneNodeInput;

export const sceneNodeSchema: z.ZodType<SceneNodeInput> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum(["div", "text", "img", "video"]),
      text: z.string().optional(),
      assetId: z.string().optional(),
      from: z.number().int().default(0),
      duration: z.number().int().positive().optional(),
      style: styleSchema.default({}),
      animations: z.array(animationSchema).default([]),
      children: z.array(sceneNodeSchema).default([]),
    })
    .superRefine((node, ctx) => {
      if (node.type === "text" && typeof node.text !== "string") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["text"],
          message: "Text nodes require a `text` string.",
        });
      }

      if ((node.type === "img" || node.type === "video") && !node.assetId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assetId"],
          message: `${node.type} nodes require an assetId that points at scene.assets.`,
        });
      }
    }),
);

export const sceneSchema = z
  .object({
    schemaVersion: z.literal(0),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    fps: z.number().int().positive(),
    duration: z.number().int().positive(),
    assets: z.record(assetSchema).default({}),
    nodes: z.array(sceneNodeSchema).default([]),
  })
  .superRefine((scene, ctx) => {
    for (const [id, asset] of Object.entries(scene.assets)) {
      if (id !== asset.id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["assets", id],
          message: `Asset map key "${id}" must match asset.id "${asset.id}".`,
        });
      }
    }
  });

export type Scene = z.infer<typeof sceneSchema>;

export class SceneValidationError extends Error {
  constructor(readonly issues: z.ZodIssue[]) {
    super(formatSceneIssues(issues));
    this.name = "SceneValidationError";
  }
}

export function parseScene(input: unknown): Scene {
  const result = sceneSchema.safeParse(input);

  if (!result.success) {
    throw new SceneValidationError(result.error.issues);
  }

  return result.data;
}

export function validateScene(input: unknown): { ok: true; scene: Scene } | { ok: false; errors: string[] } {
  const result = sceneSchema.safeParse(input);

  if (result.success) {
    return { ok: true, scene: result.data };
  }

  return {
    ok: false,
    errors: result.error.issues.map((issue) => `${issue.path.join(".") || "scene"}: ${issue.message}`),
  };
}

function formatSceneIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => `${issue.path.join(".") || "scene"}: ${issue.message}`).join("\n");
}
