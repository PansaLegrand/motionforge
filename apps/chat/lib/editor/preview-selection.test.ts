import { describe, expect, it } from "vitest";
import type { EditorLayer } from "./layers";
import {
  createPreviewSelectionOverlay,
  movePreviewLayerBoundsFromDrag,
} from "./preview-selection";

const layer: EditorLayer = {
  id: "title",
  type: "text",
  label: "Launch title",
  text: "Launch title",
  parentFrom: 0,
  depth: 0,
  localFrom: 10,
  localDuration: 40,
  from: 10,
  duration: 40,
  end: 50,
  zIndex: 0,
  paintIndex: 0,
  childCount: 0,
  bounds: {
    left: 100,
    top: 80,
    width: 400,
    height: 120,
  },
};

describe("createPreviewSelectionOverlay", () => {
  it("projects layer bounds into rendered canvas coordinates", () => {
    expect(
      createPreviewSelectionOverlay({
        layer,
        sceneWidth: 1000,
        sceneHeight: 500,
        canvasRect: { width: 500, height: 250 },
        frame: 20,
      }),
    ).toEqual({
      kind: "bounds",
      label: "Launch title · text",
      visible: true,
      rect: {
        left: 50,
        top: 40,
        width: 200,
        height: 60,
      },
    });
  });

  it("marks a selection as not visible when the playhead is outside the layer", () => {
    expect(
      createPreviewSelectionOverlay({
        layer,
        sceneWidth: 1000,
        sceneHeight: 500,
        canvasRect: { width: 500, height: 250 },
        frame: 5,
      }),
    ).toMatchObject({ visible: false });
  });

  it("falls back to an unbounded overlay for layers without explicit bounds", () => {
    expect(
      createPreviewSelectionOverlay({
        layer: { ...layer, bounds: undefined },
        sceneWidth: 1000,
        sceneHeight: 500,
        canvasRect: { width: 500, height: 250 },
        frame: 20,
      }),
    ).toEqual({
      kind: "unbounded",
      label: "Launch title · text",
      visible: true,
    });
  });
});

describe("movePreviewLayerBoundsFromDrag", () => {
  it("converts rendered canvas drag deltas back into scene coordinates", () => {
    expect(
      movePreviewLayerBoundsFromDrag({
        initialLeft: 100,
        initialTop: 80,
        startClientX: 200,
        startClientY: 100,
        currentClientX: 260,
        currentClientY: 70,
        sceneWidth: 1000,
        sceneHeight: 500,
        canvasRect: { width: 500, height: 250 },
      }),
    ).toEqual({ left: 220, top: 20 });
  });

  it("keeps the layer in place when geometry cannot be measured", () => {
    expect(
      movePreviewLayerBoundsFromDrag({
        initialLeft: 100,
        initialTop: 80,
        startClientX: 200,
        startClientY: 100,
        currentClientX: 260,
        currentClientY: 70,
        sceneWidth: 1000,
        sceneHeight: 500,
        canvasRect: { width: 0, height: 250 },
      }),
    ).toEqual({ left: 100, top: 80 });
  });
});
