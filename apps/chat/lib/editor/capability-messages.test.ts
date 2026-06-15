import { describe, expect, it } from "vitest";
import {
  describeExportReadiness,
  describePreviewOverlay,
  type ExportReadinessInput,
} from "./capability-messages";

const readyInput: ExportReadinessInput = {
  hasScene: true,
  previewLoading: false,
  previewError: null,
  exportSupported: true,
  isExporting: false,
  exportStatus: "",
  layerCount: 6,
};

describe("capability messages", () => {
  it("explains why export is disabled before a scene exists", () => {
    expect(
      describeExportReadiness({ ...readyInput, hasScene: false }),
    ).toEqual({
      disabled: true,
      status: "No scene loaded",
      title: "Create or load a scene before exporting.",
    });
  });

  it("explains preview-blocked export states", () => {
    expect(
      describeExportReadiness({ ...readyInput, previewLoading: true }),
    ).toMatchObject({
      disabled: true,
      status: "Preparing preview",
    });
    expect(
      describeExportReadiness({
        ...readyInput,
        previewError: "Missing asset image-1.",
      }),
    ).toMatchObject({
      disabled: true,
      status: "Preview error",
    });
  });

  it("explains unsupported browser export while keeping JSON available", () => {
    expect(
      describeExportReadiness({ ...readyInput, exportSupported: false }),
    ).toEqual({
      disabled: true,
      status: "MP4 unavailable · JSON available",
      title: "This browser does not expose WebCodecs VideoEncoder.",
    });
  });

  it("reports active and ready export states", () => {
    expect(
      describeExportReadiness({
        ...readyInput,
        isExporting: true,
        exportStatus: "Encoding 12/150",
      }),
    ).toMatchObject({
      disabled: true,
      status: "Encoding 12/150",
    });
    expect(describeExportReadiness(readyInput)).toEqual({
      disabled: false,
      status: "6 layers · MP4 ready",
      title: "Export MP4.",
    });
  });

  it("describes empty and error preview overlays", () => {
    expect(
      describePreviewOverlay({
        hasScene: false,
        previewLoading: false,
        previewError: null,
      }),
    ).toEqual({
      kind: "empty",
      title: "No scene loaded",
      detail: "Assistant and Examples are ready.",
    });
    expect(
      describePreviewOverlay({
        hasScene: true,
        previewLoading: false,
        previewError: "Canvas2D is unavailable.",
      }),
    ).toEqual({
      kind: "error",
      title: "Preview render failed",
      detail: "Canvas2D is unavailable.",
    });
  });
});
