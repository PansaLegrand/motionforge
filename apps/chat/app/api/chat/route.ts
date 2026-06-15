import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { gateway, generateText, type LanguageModel } from "ai";
import { NextResponse } from "next/server";
import { validateScene, type Scene } from "@motionforge/schema";
import {
  applyInstructionLocally,
  extractJsonFromText,
  normalizeModelOutput,
  type MotionforgeAgentResult,
} from "@/lib/motionforge/local-agent";
import { buildMotionforgeSystemPrompt } from "@/lib/ai/prompt";

export const runtime = "nodejs";
const DEBUG = process.env.MOTIONFORGE_DEBUG === "1";
const DEFAULT_MODEL_TIMEOUT_MS = 12_000;
const DEFAULT_GATEWAY_MODEL = "openai/gpt-4.1-mini";
const DEFAULT_OPENAI_COMPATIBLE_MODEL = "gpt-4.1-mini";

type ChatRequest = {
  instruction?: unknown;
  scene?: unknown;
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
  const localFallback = applyInstructionLocally(currentScene, instruction);

  const llm = readLlmModel();

  if (!llm.ok) {
    return json({
      ok: true,
      result: {
        ...localFallback,
        summary: `${localFallback.summary} ${llm.message}`,
      },
    });
  }

  try {
    const timeoutMs = readModelTimeoutMs();
    const controller = new AbortController();
    const abortFromRequest = () => controller.abort(request.signal.reason);
    request.signal.addEventListener("abort", abortFromRequest, { once: true });

    const modelPromise = generateText({
      model: llm.model,
      system: buildMotionforgeSystemPrompt(currentScene),
      prompt: buildUserPrompt(instruction, currentScene),
      temperature: 0.2,
      maxOutputTokens: 5000,
      abortSignal: controller.signal,
    });
    modelPromise.catch((error) => {
      debugLog("late model failure after fallback", {
        error: error instanceof Error ? error.stack ?? error.message : error,
      });
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

    debugLog("model result", {
      instruction,
      provider: llm.provider,
      modelId: llm.modelId,
      text: result.text,
    });

    const payload = extractJsonFromText(result.text);
    debugLog("parsed model payload", payload);
    const normalized = normalizeModelOutput(payload, currentScene);

    return json({
      ok: true,
      result: {
        ...normalized,
        source: "model",
      },
    });
  } catch (error) {
    debugLog("model path failed", {
      instruction,
      error: error instanceof Error ? error.stack ?? error.message : error,
    });

    return json({
      ok: true,
      result: {
        ...localFallback,
        summary: `${localFallback.summary} Model path failed, so the local fallback handled this turn.`,
        diagnostics: [
          ...localFallback.diagnostics,
          error instanceof Error ? error.message : String(error),
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

function buildUserPrompt(instruction: string, currentScene: Scene | null) {
  const sceneText = currentScene
    ? `\n\nCurrent scene JSON:\n${JSON.stringify(currentScene)}`
    : "";

  return `User instruction:\n${instruction}${sceneText}`;
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

function readModelTimeoutMs() {
  const raw = process.env.MOTIONFORGE_CHAT_TIMEOUT_MS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_MODEL_TIMEOUT_MS;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MODEL_TIMEOUT_MS;
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
