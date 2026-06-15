# motionforge chat

Next.js chat app for generating, previewing, patching, and exporting motionforge scene JSON.

## Run

From the repo root:

```sh
pnpm dev
```

This starts the chat app at `http://localhost:5174`. The older Vite playground is still available with:

```sh
pnpm dev:playground
```

## LLM Configuration

The app works without model credentials by using a local deterministic fallback. For model-backed generation, copy the example env file:

```sh
cp apps/chat/.env.example apps/chat/.env.local
```

Vercel AI Gateway is the default provider:

```sh
MOTIONFORGE_LLM_PROVIDER=gateway
AI_GATEWAY_API_KEY=...
MOTIONFORGE_CHAT_MODEL=openai/gpt-4.1-mini
```

To use an OpenAI-compatible provider:

```sh
MOTIONFORGE_LLM_PROVIDER=openai-compatible
MOTIONFORGE_OPENAI_COMPATIBLE_BASE_URL=https://api.openai.com/v1
MOTIONFORGE_OPENAI_COMPATIBLE_API_KEY=...
MOTIONFORGE_OPENAI_COMPATIBLE_NAME=custom
MOTIONFORGE_CHAT_MODEL=gpt-4.1-mini
```

## How The Chat Loop Works

The chat app is currently a JSON scene plus JSON patch loop. It does not use MCP, AI SDK tool calls, or function calling yet. The model is asked to return strict JSON, and the app validates or applies that JSON with motionforge's schema utilities.

1. The user types a prompt in the chat UI.
2. The browser sends `POST /api/chat` with the prompt, the current scene JSON, and recent chat history.
3. The API route chooses the LLM provider from `.env.local`.
4. If no model is configured, or the model path fails, the route uses the local deterministic fallback.
5. The model receives a system prompt describing the motionforge scene contract.
6. On the first turn, the model should return a complete scene:

```json
{
  "scene": {
    "schemaVersion": 0,
    "width": 1080,
    "height": 1920,
    "fps": 30,
    "duration": 150,
    "assets": {},
    "nodes": []
  },
  "summary": "Created a 5 second launch teaser."
}
```

7. On follow-up turns, the model should return patch ops against the existing scene:

```json
{
  "patch": [
    {
      "op": "setStyle",
      "id": "title",
      "style": {
        "fontSize": 112
      }
    }
  ],
  "summary": "Made the title larger."
}
```

8. The route parses the model text as JSON.
9. If the JSON contains `scene`, the app validates it with the motionforge scene schema.
10. If the JSON contains `patch`, the app applies it with `applyScenePatch`.
11. The resulting scene JSON becomes the new source of truth.
12. The preview player reloads that scene into the Canvas2D player.
13. MP4 export uses the same scene JSON and renderer path.

The important current limitation: follow-up memory is mostly the current scene JSON. The UI sends recent chat history, but the API prompt currently relies on the current scene and the latest instruction. That is enough for direct scene edits, but conversation-aware references should become a future improvement.

## How This Compares To Other Agentic Design Tools

Most agentic design and app-building products use the same broad loop:

1. The user describes a desired artifact or edit.
2. The system sends the current artifact as context.
3. The model returns either a new artifact or an edit to the existing artifact.
4. The app validates, builds, renders, or previews that result.
5. The user follows up, and the next prompt becomes another edit against the current artifact.

The main difference is the artifact format. motionforge uses a JSON scene document and JSON patch ops. Tools like [v0](https://vercel.com/blog/announcing-v0-generative-ui), Bolt, Lovable, or coding agents tend to use source files, code diffs, and build/test loops. Tools in the Open Design or tldraw "make real" family often use HTML, CSS, canvas state, or another design document as the artifact.

So the motionforge loop today is intentionally simple:

```txt
Prompt -> JSON scene or JSON patch -> schema validation -> deterministic preview/export
```

A more code-like agentic loop usually looks like this:

```txt
Prompt -> plan -> edit files/artifacts -> run validation/render checks -> repair -> preview/export
```

Structured JSON is the right starting point for this app because it is deterministic, easy to validate, easy to patch, and safer for an open-source local app. If structured responses stop being enough, the next step is not to abandon the scene schema, but to add a stronger agentic layer around it: planning, tool calls, MCP integrations, asset lookup, screenshot comparison, render scoring, and repair loops. In that future version, the JSON scene can remain the canonical video document while the agent becomes more capable at producing and improving it.

## Relevant Files

- `app/api/chat/route.ts` - provider selection, model call, JSON parsing, fallback handling.
- `lib/ai/prompt.ts` - system prompt and model output contract.
- `lib/motionforge/local-agent.ts` - local fallback generation, patch creation, model output normalization.
- `components/motionforge-chat-app.tsx` - chat UI, preview player, JSON view, MP4 export.
