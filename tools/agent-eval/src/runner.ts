// Eval runner: prompts any OpenAI-compatible chat endpoint with llms.txt as
// the system prompt, scores replies mechanically (validateScene /
// applyScenePatch + per-case assertions), and prints a pass/fail table.
//
// Configuration (env):
//   EVAL_BASE_URL — chat-completions base, e.g. https://api.example.com/v1
//   EVAL_API_KEY  — bearer token
//   EVAL_MODEL    — model name
//
// Usage: pnpm --filter @motionforge/agent-eval run eval [--suite generate|edit] [--case <id>]

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { cases, type EvalCase } from "./cases.js";
import { scoreReply } from "./score.js";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const llmsTxt = readFileSync(resolve(rootDir, "llms.txt"), "utf8");

const baseUrl = process.env["EVAL_BASE_URL"];
const apiKey = process.env["EVAL_API_KEY"];
const model = process.env["EVAL_MODEL"];

if (!baseUrl || !apiKey || !model) {
  console.error(
    "Set EVAL_BASE_URL, EVAL_API_KEY, and EVAL_MODEL to run evals against a chat endpoint.\n" +
      "The scorer itself is unit-tested offline (pnpm --filter @motionforge/agent-eval test).",
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const suiteFilter = args.includes("--suite") ? args[args.indexOf("--suite") + 1] : undefined;
const caseFilter = args.includes("--case") ? args[args.indexOf("--case") + 1] : undefined;

const selected = cases.filter(
  (c) => (!suiteFilter || c.suite === suiteFilter) && (!caseFilter || c.id === caseFilter),
);

function buildMessages(evalCase: EvalCase) {
  if (evalCase.suite === "generate") {
    return [
      {
        role: "system",
        content: `${llmsTxt}\n\nAnswer with ONLY the scene JSON document. No prose.`,
      },
      { role: "user", content: evalCase.prompt },
    ];
  }

  return [
    {
      role: "system",
      content: `${llmsTxt}\n\nYou edit scenes by answering with ONLY a JSON array of patch ops (see the patches API). No prose. For uploaded media, use only assets from the manifest and emit setAsset before insertNode when needed. Example media patch: [{"op":"setAsset","asset":{"id":"video_1","type":"video","src":"https://example.test/video.mp4"}},{"op":"insertNode","node":{"id":"video-1-node","type":"video","assetId":"video_1","from":0,"duration":90,"videoStartTime":0,"style":{"position":"absolute","left":0,"top":0,"width":1280,"height":720,"objectFit":"cover"}}}].`,
    },
    {
      role: "user",
      content: `Current scene:\n\`\`\`json\n${JSON.stringify(evalCase.scene)}\n\`\`\`\n\nUploaded media manifest:\n\`\`\`json\n${JSON.stringify(evalCase.mediaAssets ?? [])}\n\`\`\`\n\nInstruction: ${evalCase.prompt}`,
    },
  ];
}

async function complete(messages: unknown): Promise<string> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, temperature: 0 }),
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

let passed = 0;

for (const evalCase of selected) {
  let result;

  try {
    const reply = await complete(buildMessages(evalCase));
    result = scoreReply(evalCase, reply);
  } catch (error) {
    result = {
      id: evalCase.id,
      suite: evalCase.suite,
      pass: false,
      failures: [`request failed: ${error instanceof Error ? error.message : error}`],
    };
  }

  passed += result.pass ? 1 : 0;
  console.log(`${result.pass ? "ok " : "FAIL"} [${result.suite}] ${result.id}`);
  for (const failure of result.failures) {
    console.log(`     - ${failure}`);
  }
}

console.log(`\n${passed}/${selected.length} passed`);
process.exit(passed === selected.length ? 0 : 1);
