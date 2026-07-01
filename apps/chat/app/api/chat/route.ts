import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  gateway,
  generateText,
  Output,
  type LanguageModel,
} from "ai";
import { NextResponse } from "next/server";
import { validateScene, type Scene } from "@motionforge/schema";
import {
  applyInstructionLocally,
  extractJsonFromText,
  normalizeModelOutput,
  type MotionforgeAgentResult,
} from "@/lib/motionforge/local-agent";
import { buildMotionforgeSystemPrompt } from "@/lib/ai/prompt";
import {
  formatMediaAssetManifestForPrompt,
  readChatMediaAssetManifest,
} from "@/lib/media/manifest";
import type { ChatMediaAssetManifestItem } from "@/lib/media/assets";

export const runtime = "nodejs";
const DEBUG = process.env.MOTIONFORGE_DEBUG === "1";
const DEFAULT_MODEL_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_MODEL_MAX_OUTPUT_TOKENS = 12_000;
// const DEFAULT_GATEWAY_MODEL = "openai/gpt-4.1-mini";
// const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4.1-mini";
const DEFAULT_GATEWAY_MODEL = "openai/gpt-5.4";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-5.4";

type ChatRequest = {
  instruction?: unknown;
  scene?: unknown;
  mediaAssets?: unknown;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
};

type ChatResponse =
  | { ok: true; result: MotionforgeAgentResult }
  | { ok: false; error: string; fallback?: MotionforgeAgentResult };

export async function POST(request: Request) {
  let body: ChatRequest;

  try {
    body = (await request.json()) as ChatRequest;
  } catch {
    return json({ ok: false, error: "Request body must be JSON." }, 400);
  }

  const instruction = typeof body.instruction === "string" ? body.instruction.trim() : "";

  if (!instruction) {
    return json({ ok: false, error: "Instruction is required." }, 400);
  }

  const currentScene = readScene(body.scene);
  const mediaAssets = readChatMediaAssetManifest(body.mediaAssets);
  const localFallback = applyInstructionLocally(
    currentScene,
    instruction,
    mediaAssets,
  );

  const llm = readLlmModel();

  if (!llm.ok) {
    return json({
      ok: true,
      result: {
        ...localFallback,
        summary: `${localFallback.summary} ${llm.message}`.replace(
          /\s+/g,
          " ",
        ),
      },
    });
  }

  try {
    const timeoutMs = readModelTimeoutMs();
    const maxOutputTokens = readModelMaxOutputTokens();
    const controller = new AbortController();
    const abortFromRequest = () => controller.abort(request.signal.reason);
    request.signal.addEventListener("abort", abortFromRequest, { once: true });

    const modelPromise = generateText({
      model: llm.model,
      system: buildMotionforgeSystemPrompt(currentScene, mediaAssets),
      prompt: buildUserPrompt(instruction, currentScene, mediaAssets),
      output: Output.json({
        name: "MotionforgeAgentResult",
        description:
          "A JSON object containing either a complete motionforge scene plus summary, or a scene patch plus summary.",
      }),
      temperature: 0.2,
      maxOutputTokens,
      abortSignal: controller.signal,
    });

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        controller.abort(`Model request timed out after ${timeoutMs}ms.`);
        reject(new Error(`Model request timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
    });

    let result: Awaited<typeof modelPromise>;

    try {
      result = await Promise.race([modelPromise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      request.signal.removeEventListener("abort", abortFromRequest);
    }

    const structuredOutput = readStructuredOutput(result);

    debugLog("model result", {
      instruction,
      provider: llm.provider,
      modelId: llm.modelId,
      text: result.text,
      output: structuredOutput.ok ? structuredOutput.output : undefined,
      outputError: structuredOutput.ok ? undefined : structuredOutput.error,
    });

    const payload = structuredOutput.ok
      ? structuredOutput.output
      : extractJsonFromText(result.text);
    debugLog("parsed model payload", payload);
    const normalized = normalizeModelOutput(payload, currentScene, mediaAssets);

    return json({
      ok: true,
      result: {
        ...normalized,
        source: "model",
      },
    });
  } catch (error) {
    const modelError = serializeError(error);
    debugLog("model path failed", {
      instruction,
      error: modelError,
    });

    return json({
      ok: true,
      result: {
        ...localFallback,
        summary: `${localFallback.summary} Model path failed, so the local fallback handled this turn.`,
        diagnostics: [
          ...localFallback.diagnostics,
          formatModelErrorForUser(modelError),
        ],
      },
    });
  }
}

function readScene(input: unknown): Scene | null {
  if (input === null || input === undefined) {
    return null;
  }

  const result = validateScene(input);
  return result.ok ? result.scene : null;
}

function buildUserPrompt(
  instruction: string,
  currentScene: Scene | null,
  mediaAssets: ChatMediaAssetManifestItem[],
) {
  const sceneText = currentScene
    ? `\n\nCurrent scene JSON:\n${JSON.stringify(currentScene)}`
    : "";
  const mediaText = mediaAssets.length
    ? `\n\nUploaded media manifest:\n${formatMediaAssetManifestForPrompt(mediaAssets)}`
    : "";

  return `User instruction:\n${instruction}${mediaText}${sceneText}`;
}

function json(response: ChatResponse, status = 200) {
  return NextResponse.json(response, { status });
}

function debugLog(label: string, payload: unknown) {
  if (!DEBUG) {
    return;
  }

  console.log(`[motionforge/chat] ${label}`);
  console.dir(payload, { depth: null, colors: true });
}

type SerializedError = {
  name?: string;
  message: string;
  stack?: string;
  statusCode?: number;
  type?: string;
  reason?: string;
  generationId?: string;
  isRetryable?: boolean;
  url?: string;
  responseBody?: string;
  response?: unknown;
  data?: unknown;
  validationError?: SerializedError;
  cause?: SerializedError | string;
  lastError?: SerializedError | string;
  errors?: Array<SerializedError | string>;
};

function serializeError(error: unknown, depth = 0): SerializedError | string {
  if (depth > 4) {
    return "[error nesting truncated]";
  }

  if (error instanceof Error) {
    const record = error as Error & Record<string, unknown>;
    const serialized: SerializedError = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };

    for (const key of [
      "statusCode",
      "type",
      "reason",
      "generationId",
      "isRetryable",
      "url",
      "responseBody",
    ] as const) {
      const value = record[key];
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        (serialized as Record<string, unknown>)[key] = value;
      }
    }

    for (const key of ["response", "data"] as const) {
      const value = record[key];
      if (value !== undefined) {
        serialized[key] = value;
      }
    }

    const validationError = record.validationError;
    if (validationError !== undefined) {
      serialized.validationError = serializeError(validationError, depth + 1) as SerializedError;
    }

    const cause = record.cause;
    if (cause !== undefined) {
      serialized.cause = serializeError(cause, depth + 1);
    }

    const lastError = record.lastError;
    if (lastError !== undefined) {
      serialized.lastError = serializeError(lastError, depth + 1);
    }

    const errors = record.errors;
    if (Array.isArray(errors)) {
      serialized.errors = errors.map((entry) => serializeError(entry, depth + 1));
    }

    return serialized;
  }

  if (typeof error === "string") {
    return error;
  }

  return {
    message: stringifyUnknown(error),
  };
}

function formatModelErrorForUser(error: SerializedError | string): string {
  if (typeof error === "string") {
    return error;
  }

  const last = typeof error.lastError === "object" ? error.lastError : undefined;
  const primary = last ?? error;
  const parts = [
    primary.name,
    primary.type,
    primary.statusCode === undefined ? undefined : `status ${primary.statusCode}`,
    primary.message,
    primary.generationId ? `generation ${primary.generationId}` : undefined,
  ].filter(Boolean);

  return parts.join(": ");
}

function stringifyUnknown(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function readModelTimeoutMs() {
  const raw = process.env.MOTIONFORGE_CHAT_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MODEL_TIMEOUT_MS;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MODEL_TIMEOUT_MS;
}

function readModelMaxOutputTokens() {
  const raw = process.env.MOTIONFORGE_CHAT_MAX_OUTPUT_TOKENS?.trim();
  const parsed = raw
    ? Number.parseInt(raw, 10)
    : DEFAULT_MODEL_MAX_OUTPUT_TOKENS;

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_MODEL_MAX_OUTPUT_TOKENS;
}

function readStructuredOutput(
  result: Awaited<ReturnType<typeof generateText>>,
):
  | { ok: true; output: unknown }
  | { ok: false; error: string } {
  try {
    return { ok: true, output: result.output };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function readLlmModel():
  | { ok: true; provider: string; modelId: string; model: LanguageModel }
  | { ok: false; message: string } {
  const provider = process.env.MOTIONFORGE_LLM_PROVIDER?.trim() || "gateway";

  if (provider === "gateway") {
    if (!process.env.AI_GATEWAY_API_KEY?.trim()) {
      return {
        ok: false,
        message:
          "Add AI_GATEWAY_API_KEY to use Vercel AI Gateway, or set MOTIONFORGE_LLM_PROVIDER=openai-compatible with a base URL.",
      };
    }

    const modelId =
      process.env.MOTIONFORGE_CHAT_MODEL?.trim() || DEFAULT_GATEWAY_MODEL;

    return {
      ok: true,
      provider,
      modelId,
      model: gateway(modelId),
    };
  }

  if (provider === "openai-compatible") {
    const baseURL = process.env.MOTIONFORGE_OPENAI_COMPATIBLE_BASE_URL?.trim();

    if (!baseURL) {
      return {
        ok: false,
        message:
          "Set MOTIONFORGE_OPENAI_COMPATIBLE_BASE_URL in apps/chat/.env.local to use your own OpenAI-compatible provider.",
      };
    }

    const customProvider = createOpenAICompatible({
      name:
        process.env.MOTIONFORGE_OPENAI_COMPATIBLE_NAME?.trim() ||
        "motionforge-custom",
      baseURL,
      apiKey:
        process.env.MOTIONFORGE_OPENAI_COMPATIBLE_API_KEY?.trim() ||
        process.env.OPENAI_API_KEY?.trim(),
    });
    const modelId =
      process.env.MOTIONFORGE_CHAT_MODEL?.trim() ||
      DEFAULT_OPENAI_COMPATIBLE_MODEL;

    return {
      ok: true,
      provider,
      modelId,
      model: customProvider(modelId),
    };
  }

  return {
    ok: false,
    message:
      "MOTIONFORGE_LLM_PROVIDER must be either gateway or openai-compatible.",
  };
}
