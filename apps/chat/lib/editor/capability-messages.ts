export type ExportReadinessInput = {
  hasScene: boolean;
  previewLoading: boolean;
  previewError: string | null;
  exportSupported: boolean;
  isExporting: boolean;
  exportStatus: string;
  layerCount: number;
};

export type ExportReadiness = {
  disabled: boolean;
  status: string;
  title: string;
};

export type PreviewOverlay =
  | {
      kind: "empty";
      title: string;
      detail: string;
    }
  | {
      kind: "error";
      title: string;
      detail: string;
    };

export function describeExportReadiness({
  hasScene,
  previewLoading,
  previewError,
  exportSupported,
  isExporting,
  exportStatus,
  layerCount,
}: ExportReadinessInput): ExportReadiness {
  if (!hasScene) {
    return {
      disabled: true,
      status: "No scene loaded",
      title: "Create or load a scene before exporting.",
    };
  }

  if (previewLoading) {
    return {
      disabled: true,
      status: "Preparing preview",
      title: "Preview is still preparing.",
    };
  }

  if (previewError) {
    return {
      disabled: true,
      status: "Preview error",
      title: "Fix the preview error before exporting.",
    };
  }

  if (!exportSupported) {
    return {
      disabled: true,
      status: "MP4 unavailable · JSON available",
      title: "This browser does not expose WebCodecs VideoEncoder.",
    };
  }

  if (isExporting) {
    return {
      disabled: true,
      status: exportStatus || "Exporting MP4",
      title: "Export in progress.",
    };
  }

  return {
    disabled: false,
    status: exportStatus || `${layerCount} layers · MP4 ready`,
    title: "Export MP4.",
  };
}

export function describePreviewOverlay({
  hasScene,
  previewLoading,
  previewError,
}: {
  hasScene: boolean;
  previewLoading: boolean;
  previewError: string | null;
}): PreviewOverlay | null {
  if (previewLoading) {
    return null;
  }

  if (previewError) {
    return {
      kind: "error",
      title: "Preview render failed",
      detail: previewError,
    };
  }

  if (!hasScene) {
    return {
      kind: "empty",
      title: "No scene loaded",
      detail: "Assistant and Examples are ready.",
    };
  }

  return null;
}
