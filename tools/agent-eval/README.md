# agent-eval

Mechanical eval harness for LLM scene **generation** and **editing** (RFC 0001). Private tooling — never published.

The judge is not a model: replies are scored by `validateScene` / `applyScenePatch` plus per-case structural assertions (e.g. "title fontSize doubled **and** every untouched node is byte-identical"). That makes scores reproducible and turns `llms.txt`/prompt changes into measurable deltas.

## Run

```sh
EVAL_BASE_URL=https://your-endpoint/v1 \
EVAL_API_KEY=… \
EVAL_MODEL=… \
pnpm --filter @motionforge/agent-eval run eval            # all cases
pnpm --filter @motionforge/agent-eval run eval -- --suite edit
pnpm --filter @motionforge/agent-eval run eval -- --case edit-bigger-title
```

Any OpenAI-compatible chat-completions endpoint works; `llms.txt` is the system prompt, temperature 0.

## Suites

- **generate** — prompt → scene JSON. Scored by `validateScene`, then assertions (duration, canvas size, expected nodes/styles).
- **edit** — scene + instruction → patch op list. Scored by `applyScenePatch`, then assertions, including the *don't-break-the-rest* check whole-document editing can't give.

A **repair** suite (invalid scene + validator errors → fixing patch) is designed in RFC 0001 and lands when the first two have baselines.

## Offline

The scorer (`extractJson`, `scoreReply`) is pure and unit-tested without any endpoint: `pnpm --filter @motionforge/agent-eval test`. Add cases in `src/cases.ts`; every case needs at least one passing and one failing reply covered in `src/score.test.ts`.
