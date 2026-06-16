export type MediaOperationPlanStep =
  | {
      type: "sequence-clip";
      nodeId: string;
      assetId: string;
      label: string;
      mediaType: "image" | "video";
      sourceStartSeconds: number;
      sourceEndSeconds?: number;
      sceneStartFrame: number;
      durationFrames: number;
    }
  | {
      type: "text-overlay";
      nodeId: string;
      text: string;
      targetAssetId?: string;
      fromFrame: number;
      durationFrames: number;
      position: "top" | "center" | "bottom" | "custom";
    };

export type MediaOperationPlan = {
  summary: string;
  fps: number;
  steps: MediaOperationPlanStep[];
};

type TextOverlayPosition = Extract<
  MediaOperationPlanStep,
  { type: "text-overlay" }
>["position"];

export function describeMediaPlanStep(
  step: MediaOperationPlanStep,
  fps: number,
): { title: string; detail: string } {
  if (step.type === "sequence-clip") {
    const sourceRange =
      step.sourceEndSeconds === undefined
        ? "full duration"
        : `${formatMediaClock(step.sourceStartSeconds)}-${formatMediaClock(step.sourceEndSeconds)}`;

    return {
      title: `${step.label} - ${sourceRange}`,
      detail: `Starts ${formatFrameClock(step.sceneStartFrame, fps)} - ${formatFrameCount(step.durationFrames)}`,
    };
  }

  return {
    title: `Text - ${quoteCompactText(step.text)}`,
    detail: `${formatPosition(step.position)} - starts ${formatFrameClock(step.fromFrame, fps)} - ${formatFrameCount(step.durationFrames)}`,
  };
}

export function formatMediaClock(seconds: number): string {
  const centiseconds = Math.max(0, Math.round(seconds * 100));
  const minutes = Math.floor(centiseconds / 6000);
  const secondsRemainder = centiseconds % 6000;
  const wholeSeconds = Math.floor(secondsRemainder / 100);
  const fractional = secondsRemainder % 100;
  const base = `${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}`;

  if (!fractional) {
    return base;
  }

  return `${base}.${String(fractional).padStart(2, "0").replace(/0+$/, "")}`;
}

function formatFrameClock(frame: number, fps: number): string {
  return formatMediaClock(frame / Math.max(1, fps));
}

function formatFrameCount(frames: number): string {
  return `${frames} frame${frames === 1 ? "" : "s"}`;
}

function quoteCompactText(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  const truncated =
    compact.length > 34 ? `${compact.slice(0, 31).trimEnd()}...` : compact;

  return `"${truncated}"`;
}

function formatPosition(position: TextOverlayPosition) {
  return position === "custom" ? "custom position" : position;
}
