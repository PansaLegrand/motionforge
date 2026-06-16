import type { ScenePatch } from "@motionforge/schema";

export type InspectorEditableField =
  | "text"
  | "from"
  | "duration"
  | "left"
  | "top"
  | "width"
  | "height"
  | "opacity"
  | "color"
  | "fontSize"
  | "fontWeight"
  | "textAlign"
  | "textStroke"
  | "videoStartTime"
  | "audioStartTime"
  | "playbackRate"
  | "volume"
  | "objectFit"
  | "objectPosition";

export type InspectorEditResult =
  | { ok: true; patch: ScenePatch }
  | { ok: false; error: string };

const styleFields = new Set<InspectorEditableField>([
  "left",
  "top",
  "width",
  "height",
  "opacity",
  "color",
  "fontSize",
  "fontWeight",
  "textAlign",
  "textStroke",
  "objectFit",
  "objectPosition",
]);

const textAlignValues = new Set(["left", "center", "right"]);
const objectFitValues = new Set(["cover", "contain", "fill", "none", "scale-down"]);

export function createInspectorPatch(
  nodeId: string,
  field: InspectorEditableField,
  rawValue: string,
): InspectorEditResult {
  const id = nodeId.trim();

  if (!id) {
    return { ok: false, error: "Select a layer before editing." };
  }

  if (field === "text") {
    return { ok: true, patch: [{ op: "setText", id, text: rawValue }] };
  }

  if (field === "from" || field === "duration") {
    const value = parseInteger(rawValue, field);

    if (!value.ok) {
      return value;
    }

    return {
      ok: true,
      patch: [
        field === "from"
          ? { op: "retime", id, from: value.value }
          : { op: "retime", id, duration: value.value },
      ],
    };
  }

  if (styleFields.has(field)) {
    const value = parseStyleValue(field, rawValue);

    if (!value.ok) {
      return value;
    }

    return {
      ok: true,
      patch: [
        {
          op: "setStyle",
          id,
          style: { [field]: value.value },
        },
      ],
    };
  }

  if (
    field === "videoStartTime" ||
    field === "audioStartTime" ||
    field === "playbackRate" ||
    field === "volume"
  ) {
    const value = parseNodePropValue(field, rawValue);

    if (!value.ok) {
      return value;
    }

    return {
      ok: true,
      patch: [
        {
          op: "setNodeProps",
          id,
          props: { [field]: value.value },
        },
      ],
    };
  }

  return { ok: false, error: `Unsupported inspector field: ${field}.` };
}

function parseStyleValue(
  field: InspectorEditableField,
  rawValue: string,
):
  | { ok: true; value: number | string | null }
  | { ok: false; error: string } {
  switch (field) {
    case "left":
    case "top":
    case "width":
    case "height":
      return parseOptionalNumber(rawValue, field);
    case "opacity":
      return parseOpacity(rawValue);
    case "fontSize":
      return parseOptionalLength(rawValue);
    case "fontWeight":
      return parseOptionalFontWeight(rawValue);
    case "color":
    case "textStroke":
      return parseOptionalString(rawValue);
    case "textAlign":
      return parseTextAlign(rawValue);
    case "objectFit":
      return parseObjectFit(rawValue);
    case "objectPosition":
      return parseOptionalString(rawValue);
    default:
      return { ok: false, error: `Unsupported inspector field: ${field}.` };
  }
}

function parseNodePropValue(
  field: InspectorEditableField,
  rawValue: string,
):
  | { ok: true; value: number | null }
  | { ok: false; error: string } {
  switch (field) {
    case "videoStartTime":
      return parseNonnegativeOptionalNumber(rawValue, "videoStartTime");
    case "audioStartTime":
      return parseNonnegativeOptionalNumber(rawValue, "audioStartTime");
    case "playbackRate":
      return parsePositiveOptionalNumber(rawValue, "playbackRate");
    case "volume":
      return parseVolume(rawValue);
    default:
      return { ok: false, error: `Unsupported inspector field: ${field}.` };
  }
}

function parseInteger(
  rawValue: string,
  label: string,
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: false, error: `${label} must be a whole frame number.` };
  }

  const value = Number(trimmed);

  if (!Number.isInteger(value)) {
    return { ok: false, error: `${label} must be a whole frame number.` };
  }

  if (label === "duration" && value <= 0) {
    return { ok: false, error: "duration must be greater than 0." };
  }

  if (label === "from" && value < 0) {
    return { ok: false, error: "from must be 0 or greater." };
  }

  return { ok: true, value };
}

function parseOptionalNumber(
  rawValue: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return { ok: false, error: `${label} must be a number.` };
  }

  return { ok: true, value };
}

function parseOptionalLength(
  rawValue: string,
): { ok: true; value: number | string | null } | { ok: false; error: string } {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  const value = Number(trimmed);

  if (Number.isFinite(value)) {
    return { ok: true, value };
  }

  return { ok: true, value: trimmed };
}

function parseOpacity(
  rawValue: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalNumber(rawValue, "opacity");

  if (!parsed.ok || parsed.value === null) {
    return parsed;
  }

  if (parsed.value < 0 || parsed.value > 1) {
    return { ok: false, error: "opacity must be between 0 and 1." };
  }

  return parsed;
}

function parseVolume(
  rawValue: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalNumber(rawValue, "volume");

  if (!parsed.ok || parsed.value === null) {
    return parsed;
  }

  if (parsed.value < 0 || parsed.value > 1) {
    return { ok: false, error: "volume must be between 0 and 1." };
  }

  return parsed;
}

function parseNonnegativeOptionalNumber(
  rawValue: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalNumber(rawValue, label);

  if (!parsed.ok || parsed.value === null) {
    return parsed;
  }

  if (parsed.value < 0) {
    return { ok: false, error: `${label} must be 0 or greater.` };
  }

  return parsed;
}

function parsePositiveOptionalNumber(
  rawValue: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalNumber(rawValue, label);

  if (!parsed.ok || parsed.value === null) {
    return parsed;
  }

  if (parsed.value <= 0) {
    return { ok: false, error: `${label} must be greater than 0.` };
  }

  return parsed;
}

function parseOptionalString(
  rawValue: string,
): { ok: true; value: string | null } {
  const trimmed = rawValue.trim();
  return { ok: true, value: trimmed || null };
}

function parseOptionalFontWeight(
  rawValue: string,
): { ok: true; value: number | string | null } | { ok: false; error: string } {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (trimmed === "normal" || trimmed === "bold") {
    return { ok: true, value: trimmed };
  }

  const value = Number(trimmed);

  if (!Number.isInteger(value) || value <= 0) {
    return {
      ok: false,
      error: "fontWeight must be a positive whole number, normal, or bold.",
    };
  }

  return { ok: true, value };
}

function parseTextAlign(
  rawValue: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (!textAlignValues.has(trimmed)) {
    return { ok: false, error: "textAlign must be left, center, or right." };
  }

  return { ok: true, value: trimmed };
}

function parseObjectFit(
  rawValue: string,
): { ok: true; value: string | null } | { ok: false; error: string } {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return { ok: true, value: null };
  }

  if (!objectFitValues.has(trimmed)) {
    return {
      ok: false,
      error: "objectFit must be cover, contain, fill, none, or scale-down.",
    };
  }

  return { ok: true, value: trimmed };
}
