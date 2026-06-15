import type { ScenePatch } from "@motionforge/schema";

export type InspectorEditableField =
  | "text"
  | "from"
  | "duration"
  | "left"
  | "top"
  | "width"
  | "height"
  | "opacity";

export type InspectorEditResult =
  | { ok: true; patch: ScenePatch }
  | { ok: false; error: string };

const styleFields = new Set<InspectorEditableField>([
  "left",
  "top",
  "width",
  "height",
  "opacity",
]);

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
    const value =
      field === "opacity"
        ? parseOpacity(rawValue)
        : parseOptionalNumber(rawValue, field);

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

  return { ok: false, error: `Unsupported inspector field: ${field}.` };
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
