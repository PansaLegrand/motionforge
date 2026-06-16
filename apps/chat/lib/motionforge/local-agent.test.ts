import { describe, expect, it } from "vitest";
import {
  validateScene,
  type Scene,
  type SceneAnimation,
} from "@motionforge/schema";
import {
  applyInstructionLocally,
  createSceneFromInstruction,
  normalizeModelOutput,
} from "./local-agent";

function nodeById(scene: Scene, id: string) {
  return scene.nodes.find((node) => node.id === id);
}

function animationStart(
  animations: SceneAnimation[] | undefined,
  property: string,
): number {
  const frames =
    animations?.find((animation) => animation.property === property)?.frames ??
    [];
  const [first, second] = frames;

  if (first && second && first.frame === 0 && first.value === second.value) {
    return second.frame;
  }

  return first?.frame ?? -1;
}

describe("local motionforge agent", () => {
  it("creates schema-valid first draft scenes", () => {
    const scene = createSceneFromInstruction(
      "Make a vertical product launch teaser for a new AI video app.",
    );

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.width).toBe(1080);
    expect(scene.height).toBe(1920);
    expect(nodeById(scene, "title")?.text).toContain("Vertical product");
  });

  it("creates native caption-template tracks for named subtitle prompts", () => {
    const scene = createSceneFromInstruction(
      "Make a vertical video with neon karaoke subtitles.",
    );
    const caption = nodeById(scene, "caption");
    const firstSegment = caption?.children?.[0];
    const firstWord = firstSegment?.children?.[0];

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(caption?.type).toBe("div");
    expect(firstWord?.type).toBe("text");
    expect(
      firstWord?.animations?.some((entry) => entry.property === "color"),
    ).toBe(true);
    expect(firstWord?.style?.textStroke).toBe("3px rgba(3,7,18,0.82)");
  });

  it("creates a subtitle template gallery preview from the examples prompt", () => {
    const scene = createSceneFromInstruction(
      "Show a subtitle template gallery previewing all caption styles.",
    );
    const title = nodeById(scene, "title");
    const neonCard = nodeById(scene, "template-neon");
    const spotlightCard = nodeById(scene, "template-spotlight");

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(title?.text).toBe("Subtitle Templates");
    expect(
      scene.nodes.filter((node) => node.id.startsWith("template-")),
    ).toHaveLength(13);
    expect(neonCard?.children?.[1]?.id).toBe("template-neon-sample");
    expect(spotlightCard?.children?.[1]?.children).toHaveLength(4);
  });

  it("uses preset timeline choreography for the first draft", () => {
    const scene = createSceneFromInstruction(
      "Create a kinetic typography scene saying SHIP THE DEMO.",
    );
    const panel = nodeById(scene, "accent-panel");
    const eyebrow = nodeById(scene, "eyebrow");
    const title = nodeById(scene, "title");
    const subtitle = nodeById(scene, "subtitle");
    const caption = nodeById(scene, "caption");

    expect(animationStart(panel?.animations, "transform")).toBe(0);
    expect(animationStart(eyebrow?.animations, "opacity")).toBe(6);
    expect(animationStart(title?.animations, "transform")).toBe(12);
    expect(animationStart(subtitle?.animations, "transform")).toBe(30);
    expect(animationStart(caption?.animations, "transform")).toBe(40);
    expect(
      title?.animations?.some((animation) =>
        animation.frames.some((frame) => frame.easing?.startsWith("spring(")),
      ),
    ).toBe(true);
  });

  it("applies follow-up instructions as patches", () => {
    const scene = createSceneFromInstruction("Make a calm founder update.");
    const result = applyInstructionLocally(scene, "Make the title bigger.");

    expect(result.mode).toBe("patch");
    expect(result.patch).toEqual([
      {
        op: "setStyle",
        id: "title",
        style: { fontSize: 105 },
      },
    ]);
    expect(nodeById(result.scene, "title")?.style?.fontSize).toBe(105);
  });

  it("inserts community subtitle templates as native scene nodes", () => {
    const scene = createSceneFromInstruction("Make a calm founder update.");
    const result = applyInstructionLocally(
      scene,
      "Add terminal subtitle captions near the bottom.",
    );
    const inserted = nodeById(result.scene, "terminal-captions");

    expect(result.mode).toBe("patch");
    expect(result.patch?.[0]).toMatchObject({
      op: "insertNode",
      node: { id: "terminal-captions", type: "div" },
    });
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
    expect(inserted?.children?.[0]?.children?.[0]?.style?.fontFamily).toContain(
      "Courier New",
    );
  });

  it("compiles local media instructions when uploaded assets are available", () => {
    const result = applyInstructionLocally(
      null,
      'Put video one first from 5 to 10 seconds, then video two full, write text "I love this" on top.',
      [
        {
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          src: "blob:video-1",
          label: "Video 1",
          aliases: ["video one", "first video"],
          fileName: "first.mp4",
          durationSeconds: 20,
          width: 1920,
          height: 1080,
          alreadyInScene: false,
        },
        {
          id: "video-2",
          sceneAssetId: "video_2",
          type: "video",
          src: "blob:video-2",
          label: "Video 2",
          aliases: ["video two", "second video"],
          fileName: "second.mp4",
          durationSeconds: 12,
          width: 1920,
          height: 1080,
          alreadyInScene: false,
        },
      ],
    );

    expect(result.mode).toBe("scene");
    expect(result.patch?.[0]).toEqual({ op: "setSceneMeta", duration: 510 });
    expect(result.scene.nodes.map((node) => node.id)).toEqual([
      "video-1-node",
      "video-2-node",
      "video-2-text",
    ]);
    expect(result.mediaPlan?.steps.map((step) => step.nodeId)).toEqual([
      "video-1-node",
      "video-2-node",
      "video-2-text",
    ]);
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });

  it("repairs model media patches using the uploaded asset manifest", () => {
    const result = normalizeModelOutput(
      {
        patch: [
          {
            op: "insertNode",
            node: {
              id: "model-clip",
              type: "video",
              assetId: "video-1",
              from: 0,
              duration: 90,
              videoStartTime: 2,
              style: { width: 1280, height: 720 },
            },
          },
        ],
        summary: "Added uploaded video.",
      },
      {
        schemaVersion: 0,
        width: 1280,
        height: 720,
        fps: 30,
        duration: 90,
        assets: {},
        nodes: [],
      },
      [
        {
          id: "video-1",
          sceneAssetId: "video_1",
          type: "video",
          src: "blob:video-1",
          label: "Video 1",
          aliases: ["video one", "first video"],
          fileName: "first.mp4",
          durationSeconds: 8,
          width: 1280,
          height: 720,
          alreadyInScene: false,
        },
      ],
    );

    expect(result.patch).toMatchObject([
      { op: "setAsset", asset: { id: "video_1", src: "blob:video-1" } },
      { op: "insertNode", node: { id: "model-clip", assetId: "video_1" } },
    ]);
    expect(result.diagnostics.join("\n")).toContain("Repaired node assetId");
    expect(validateScene(result.scene)).toMatchObject({ ok: true });
  });
});
