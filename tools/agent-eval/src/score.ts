import {
  applyScenePatch,
  validateScene,
  type Scene,
} from "@motionforge/schema";
import type { EvalCase } from "./cases.js";

export type CaseResult = {
  id: string;
  suite: "generate" | "edit";
  pass: boolean;
  failures: string[];
};

/**
 * Pulls the first JSON value out of a model reply: tolerates code fences and
 * prose around the JSON, because that is what models actually emit.
 */
export function extractJson(reply: string): unknown | undefined {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates = fenced?.[1] ? [fenced[1]] : [];

  // Fall back to the first {...} or [...] span balanced from the outside.
  const start = reply.search(/[[{]/);
  if (start !== -1) {
    candidates.push(reply.slice(start));
  }

  for (const candidate of candidates) {
    const trimmed = candidate.trim();

    // Try whole, then progressively trim trailing junk after the JSON.
    for (let end = trimmed.length; end > 0; end -= 1) {
      const ch = trimmed[end - 1];
      if (ch !== "}" && ch !== "]") continue;
      try {
        return JSON.parse(trimmed.slice(0, end));
      } catch {
        // keep shrinking
      }
    }
  }

  return undefined;
}

/** Scores one model reply against its case. Pure — the judge is mechanical. */
export function scoreReply(evalCase: EvalCase, reply: string): CaseResult {
  const failures: string[] = [];
  const json = extractJson(reply);

  if (json === undefined) {
    return fail(evalCase, ["reply contained no parseable JSON"]);
  }

  if (evalCase.suite === "generate") {
    const result = validateScene(json);

    if (!result.ok) {
      return fail(evalCase, result.errors.map((e) => `validateScene: ${e}`));
    }

    failures.push(...evalCase.assert(result.scene));
    return done(evalCase, failures);
  }

  // edit suite: the reply must be a patch op list applied to the case scene.
  const result = applyScenePatch(evalCase.scene, json);

  if (!result.ok) {
    return fail(
      evalCase,
      result.errors.map((e) => `applyScenePatch: ${e.message}`),
    );
  }

  failures.push(...evalCase.assert(evalCase.scene as Scene, result.scene));
  return done(evalCase, failures);
}

function fail(evalCase: EvalCase, failures: string[]): CaseResult {
  return { id: evalCase.id, suite: evalCase.suite, pass: false, failures };
}

function done(evalCase: EvalCase, failures: string[]): CaseResult {
  return {
    id: evalCase.id,
    suite: evalCase.suite,
    pass: failures.length === 0,
    failures,
  };
}
