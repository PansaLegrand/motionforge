import { describe, expect, it } from "vitest";
import { applyScenePatch, type Scene } from "@motionforge/schema";
import { createInspectorPatch } from "./inspector-patches";

const scene: Scene = {
  schemaVersion: 0,
  width: 1080,
  height: 1920,
  fps: 30,
  duration: 120,
  assets: {},
  nodes: [
    {
      id: "title",
      type: "text",
      text: "Original",
      from: 0,
      duration: 90,
      style: {
        position: "absolute",
        left: 100,
        top: 200,
        width: 600,
        opacity: 1,
        color: "#ffffff",
        fontSize: 72,
        fontWeight: 800,
        textAlign: "center",
        textStroke: "4px #000000",
      },
    },
  ],
};

describe("createInspectorPatch", () => {
  it("creates text patches", () => {
    const result = createInspectorPatch("title", "text", "Updated title");

    expect(result).toEqual({
      ok: true,
      patch: [{ op: "setText", id: "title", text: "Updated title" }],
    });
  });

  it("creates timing patches that apply through the schema patch API", () => {
    const result = createInspectorPatch("title", "duration", "45");

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    const applied = applyScenePatch(scene, result.patch);

    expect(applied.ok).toBe(true);
    expect(applied.ok ? applied.scene.nodes[0]?.duration : undefined).toBe(45);
  });

  it("creates style patches and uses blank numeric fields to delete style values", () => {
    const left = createInspectorPatch("title", "left", "240");
    const height = createInspectorPatch("title", "height", "");
    const fontSize = createInspectorPatch("title", "fontSize", "96");

    expect(left).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { left: 240 } }],
    });
    expect(height).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { height: null } }],
    });
    expect(fontSize).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { fontSize: 96 } }],
    });
    expect(createInspectorPatch("title", "fontSize", "72px")).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { fontSize: "72px" } }],
    });
  });

  it("creates text style patches and deletes blank string values", () => {
    const color = createInspectorPatch("title", "color", "#14b8a6");
    const align = createInspectorPatch("title", "textAlign", "right");
    const stroke = createInspectorPatch("title", "textStroke", "");
    const weight = createInspectorPatch("title", "fontWeight", "bold");

    expect(color).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { color: "#14b8a6" } }],
    });
    expect(align).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { textAlign: "right" } }],
    });
    expect(stroke).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { textStroke: null } }],
    });
    expect(weight).toEqual({
      ok: true,
      patch: [{ op: "setStyle", id: "title", style: { fontWeight: "bold" } }],
    });
  });

  it("rejects invalid field values before patching", () => {
    expect(createInspectorPatch("title", "duration", "0")).toEqual({
      ok: false,
      error: "duration must be greater than 0.",
    });
    expect(createInspectorPatch("title", "from", "-1")).toEqual({
      ok: false,
      error: "from must be 0 or greater.",
    });
    expect(createInspectorPatch("title", "opacity", "1.4")).toEqual({
      ok: false,
      error: "opacity must be between 0 and 1.",
    });
    expect(createInspectorPatch("title", "textAlign", "justify")).toEqual({
      ok: false,
      error: "textAlign must be left, center, or right.",
    });
    expect(createInspectorPatch("title", "fontWeight", "heavy")).toEqual({
      ok: false,
      error: "fontWeight must be a positive whole number, normal, or bold.",
    });
  });
});
