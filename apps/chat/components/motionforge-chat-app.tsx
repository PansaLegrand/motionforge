"use client";

import {
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import {
  disposeAssets,
  resolveAssets,
  type ResolvedAssets,
} from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";
import { promptChips } from "@/lib/motionforge/examples";
import type { MotionforgeAgentResult } from "@/lib/motionforge/local-agent";
import { cn } from "@/lib/ui/cn";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "local" | "model";
  diagnostics?: string[];
};

type ChatApiResponse =
  | { ok: true; result: MotionforgeAgentResult }
  | { ok: false; error: string };

const initialMessages: Message[] = [
  {
    id: "new-session",
    role: "assistant",
    content: "New session ready. Describe a video to generate the first scene.",
    source: "local",
  },
];

export function MotionforgeChatApp() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [showExamples, setShowExamples] = useState(false);
  const [playerState, setPlayerState] = useState<{
    loading: boolean;
    frame: number;
    playing: boolean;
    error: string | null;
    exportSupported: boolean;
  }>({
    loading: true,
    frame: 0,
    playing: false,
    error: null,
    exportSupported: false,
  });
  const [showJson, setShowJson] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const assetsRef = useRef<ResolvedAssets | undefined>(undefined);
  const loadIdRef = useRef(0);
  const messagesScrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const durationLabel = useMemo(
    () => (scene ? `${(scene.duration / scene.fps).toFixed(1)}s` : "new"),
    [scene],
  );
  const sceneJson = useMemo(
    () => (scene ? JSON.stringify(scene, null, 2) : ""),
    [scene],
  );

  const loadScene = useCallback(async (nextScene: Scene | null) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      setPlayerState((state) => ({
        ...state,
        loading: false,
        error: "Canvas2D is unavailable.",
      }));
      return;
    }

    const loadId = ++loadIdRef.current;
    playerRef.current?.dispose();
    playerRef.current = null;
    const previousAssets = assetsRef.current;
    assetsRef.current = undefined;
    setPlayerState((state) => ({
      ...state,
      loading: Boolean(nextScene),
      playing: false,
      frame: 0,
      error: null,
      exportSupported: detectExportCapability().videoEncoder,
    }));

    if (!nextScene) {
      canvas.width = 1080;
      canvas.height = 1920;
      context.clearRect(0, 0, canvas.width, canvas.height);
      previousAssets && disposeAssets(previousAssets);
      setPlayerState((state) => ({
        ...state,
        loading: false,
        playing: false,
        frame: 0,
        error: null,
      }));
      return;
    }

    canvas.width = nextScene.width;
    canvas.height = nextScene.height;
    context.clearRect(0, 0, canvas.width, canvas.height);

    try {
      const assets = await resolveAssets(nextScene);

      if (loadId !== loadIdRef.current) {
        disposeAssets(assets);
        return;
      }

      previousAssets && disposeAssets(previousAssets);
      assetsRef.current = assets;

      const player = await createPlayer({
        context,
        scene: nextScene,
        assets,
        loop: true,
      });

      if (loadId !== loadIdRef.current) {
        player.dispose();
        return;
      }

      player.on("frame", (frame) => {
        setPlayerState((state) => ({ ...state, frame }));
      });
      const posterFrame = Math.min(
        Math.max(Math.round(nextScene.fps * 1.2), 0),
        nextScene.duration - 1,
      );

      playerRef.current = player;
      await player.seek(posterFrame);
      setPlayerState((state) => ({
        ...state,
        loading: false,
        frame: posterFrame,
        playing: false,
        error: null,
      }));
    } catch (error) {
      if (loadId === loadIdRef.current) {
        previousAssets && disposeAssets(previousAssets);
        setPlayerState((state) => ({
          ...state,
          loading: false,
          playing: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    }
  }, []);

  useEffect(() => {
    void loadScene(scene);

    return () => {
      loadIdRef.current += 1;
      playerRef.current?.dispose();
      playerRef.current = null;
      if (assetsRef.current) {
        disposeAssets(assetsRef.current);
        assetsRef.current = undefined;
      }
    };
  }, [loadScene, scene]);

  useEffect(() => {
    if (!showExamples) {
      return;
    }

    const closeExamples = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowExamples(false);
      }
    };

    window.addEventListener("keydown", closeExamples);

    return () => window.removeEventListener("keydown", closeExamples);
  }, [showExamples]);

  useEffect(() => {
    const scroller = messagesScrollerRef.current;

    if (!scroller) {
      return;
    }

    scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
  }, [isSending, messages.length]);

  useEffect(() => {
    if (isSending) {
      return;
    }

    const timer = window.setTimeout(() => textareaRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isSending, messages.length]);

  const submitPrompt = useCallback(
    async (value?: string) => {
      const instruction = (value ?? input).trim();

      if (!instruction || isSending) {
        return;
      }

      setInput("");
      setIsSending(true);
      setExportStatus("");
      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: instruction,
      };
      setMessages((items) => [...items, userMessage]);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction,
            scene,
            history: messages.slice(-8).map(({ role, content }) => ({
              role,
              content,
            })),
          }),
        });
        const payload = (await response.json()) as ChatApiResponse;

        if (!payload.ok) {
          throw new Error(payload.error);
        }

        setScene(payload.result.scene);
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: payload.result.summary,
            source: payload.result.source,
            diagnostics: payload.result.diagnostics,
          },
        ]);
      } catch (error) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: error instanceof Error ? error.message : String(error),
            diagnostics: ["The scene was not changed."],
          },
        ]);
      } finally {
        setIsSending(false);
      }
    },
    [input, isSending, messages, scene],
  );

  const togglePlayback = useCallback(() => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    if (player.playing) {
      player.pause();
      setPlayerState((state) => ({ ...state, playing: false }));
    } else {
      player.play();
      setPlayerState((state) => ({ ...state, playing: true }));
    }
  }, []);

  const seek = useCallback((frame: number) => {
    const player = playerRef.current;

    if (!player) {
      return;
    }

    player.pause();
    setPlayerState((state) => ({ ...state, playing: false, frame }));
    void player.seek(frame);
  }, []);

  const startNewSession = useCallback(() => {
    setScene(null);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "New session ready. Describe a video to generate the first scene.",
        source: "local",
      },
    ]);
    setInput("");
    setExportStatus("");
    setShowJson(false);
  }, []);

  const exportCurrentScene = useCallback(async () => {
    if (!scene || !playerState.exportSupported || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportStatus("Starting export...");

    try {
      const { blob, codec, totalFrames } = await exportVideo({
        scene,
        assets: assetsRef.current,
        onProgress: ({ frameIndex, totalFrames: total }) => {
          setExportStatus(`Encoding ${frameIndex + 1}/${total}`);
        },
      });
      downloadBlob(blob, `motionforge-chat-${Date.now()}.mp4`);
      setExportStatus(
        `MP4 ready · ${(blob.size / 1024).toFixed(0)} KiB · ${codec} · ${totalFrames} frames`,
      );
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, playerState.exportSupported, scene]);

  const copySceneJson = useCallback(async () => {
    if (!sceneJson) {
      return;
    }

    try {
      await navigator.clipboard.writeText(sceneJson);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1400);
    } catch {
      setCopyStatus("error");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  }, [sceneJson]);

  const selectExample = useCallback((example: string) => {
    setInput(example);
    setShowExamples(false);
  }, []);

  return (
    <main className="h-[100dvh] min-h-0 overflow-hidden bg-background text-foreground">
      <div className="grid h-full min-h-0 grid-cols-[minmax(440px,560px)_minmax(0,1fr)] overflow-hidden">
        <section className="flex min-h-0 min-w-0 flex-col border-r border-border bg-card">
          <header className="flex h-16 items-center justify-between border-b border-border px-4">
            <div>
              <h1 className="text-base font-semibold tracking-normal">motionforge chat</h1>
              <p className="text-xs text-muted-foreground">
                {scene
                  ? `${scene.width}x${scene.height} · ${scene.fps}fps · ${durationLabel}`
                  : "New session"}
              </p>
            </div>
            <button
              type="button"
              onClick={startNewSession}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
              title="New session"
            >
              <Plus className="h-4 w-4" />
            </button>
          </header>

          <div
            ref={messagesScrollerRef}
            className="scrollbar-thin min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-3 pt-4"
            aria-live="polite"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  message.role === "user" ? "flex justify-end" : "w-full",
                )}
              >
                <div
                  className={cn(
                    message.role === "user"
                      ? "max-w-[82%] rounded-[26px] bg-muted px-5 py-4 text-foreground shadow-soft"
                      : "max-w-none px-1 text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex items-center gap-2 text-[11px] font-medium uppercase text-muted-foreground",
                      message.role === "user" ? "justify-end" : "",
                    )}
                  >
                    {message.role === "user" ? "You" : "Agent"}
                    {message.source ? (
                      <span className="rounded-full bg-white px-2 py-0.5 normal-case text-muted-foreground">
                        {message.source}
                      </span>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-[15px] leading-7">
                    {message.content}
                  </p>
                  {message.diagnostics?.length ? (
                    <pre className="mt-3 max-h-28 overflow-auto rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                      {message.diagnostics.join("\n")}
                    </pre>
                  ) : null}
                </div>
              </div>
            ))}
            {isSending ? (
              <div className="w-full">
                <div className="inline-flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking
                </div>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 px-4 pb-4 pt-0">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submitPrompt();
              }}
            >
              <div className="overflow-hidden rounded-[30px] border border-border bg-white text-left shadow-soft">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (input.trim() && !isSending) {
                        event.currentTarget.form?.requestSubmit();
                      }
                    }
                  }}
                  placeholder="Describe the video or ask for an edit..."
                  rows={scene ? 3 : 4}
                  className={cn(
                    "w-full resize-none border-0 bg-transparent px-5 py-4 text-base leading-7 text-foreground outline-none ring-0 transition placeholder:text-muted-foreground focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60",
                    scene ? "min-h-20" : "min-h-32",
                  )}
                  disabled={isSending}
                />
                <div className="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setShowExamples(true)}
                    disabled={isSending}
                    className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    Examples
                  </button>
                  <button
                    type="submit"
                    disabled={!input.trim() || isSending}
                    className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background shadow-sm hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    Send
                  </button>
                </div>
              </div>
            </form>
          </div>
        </section>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-[hsl(210_20%_96%)]">
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-5">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold">Preview</h2>
                <p className="text-xs text-muted-foreground">
                  {scene
                    ? `Frame ${playerState.frame + 1}/${scene.duration}`
                    : "No scene yet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowJson((value) => !value)}
                disabled={!scene}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-white px-3 text-sm text-muted-foreground hover:text-foreground"
              >
                <FileJson className="h-4 w-4" />
                {showJson ? "Hide JSON" : "View JSON"}
              </button>
              <button
                type="button"
                onClick={exportCurrentScene}
                disabled={
                  isExporting ||
                  !scene ||
                  playerState.loading ||
                  Boolean(playerState.error) ||
                  !playerState.exportSupported
                }
                className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-medium text-accent-foreground shadow-sm hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Export MP4
              </button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
            <div className="flex min-h-0 min-w-0 items-center justify-center overflow-hidden p-4">
              <div className="relative flex h-full max-h-full w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-[hsl(218_22%_13%)] shadow-soft">
                <canvas
                  ref={canvasRef}
                  className="h-auto max-h-full w-auto max-w-full object-contain"
                  style={{
                    aspectRatio: `${scene?.width ?? 1080} / ${scene?.height ?? 1920}`,
                  }}
                />
                {!scene && !playerState.loading ? (
                  <div className="absolute inset-0 flex items-center justify-center text-center">
                    <div className="max-w-xs px-6">
                      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-medium text-white">New scene</p>
                      <p className="mt-1 text-xs leading-5 text-white/68">
                        Send a prompt to generate the first preview.
                      </p>
                    </div>
                  </div>
                ) : null}
                {playerState.loading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : null}
                {playerState.error ? (
                  <div className="absolute inset-x-6 top-6 rounded-md border border-destructive/30 bg-white p-3 text-sm text-destructive">
                    {playerState.error}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="shrink-0 border-t border-border bg-card px-5 py-4">
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlayback}
                  disabled={!scene || playerState.loading || Boolean(playerState.error)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                  title={playerState.playing ? "Pause" : "Play"}
                >
                  {playerState.playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={(scene?.duration ?? 1) - 1}
                  value={playerState.frame}
                  disabled={!scene}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="h-2 flex-1 accent-[hsl(var(--primary))]"
                />
                <output className="w-20 rounded-md bg-muted px-2 py-1 text-center font-mono text-xs text-muted-foreground">
                  {playerState.frame + 1}
                </output>
              </div>
              <div className="flex min-h-5 items-center justify-between text-xs text-muted-foreground">
                <span>
                  {playerState.exportSupported
                    ? scene
                      ? exportStatus
                      : "Start with a prompt to create a scene."
                    : "MP4 export requires WebCodecs VideoEncoder."}
                </span>
                <span>{scene ? `${scene.nodes.length} root nodes` : "new draft"}</span>
              </div>
            </div>
          </div>

          {showJson ? (
            <div className="h-56 border-t border-border bg-[hsl(220_18%_12%)]">
              <div className="flex h-10 items-center justify-between border-b border-white/10 px-4">
                <span className="text-xs font-medium uppercase text-[hsl(180_40%_78%)]">
                  Scene JSON
                </span>
                <button
                  type="button"
                  onClick={copySceneJson}
                  className="inline-flex h-7 items-center gap-2 rounded-md border border-white/15 bg-white/10 px-2.5 text-xs text-[hsl(180_40%_86%)] hover:bg-white/15"
                >
                  {copyStatus === "copied" ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copyStatus === "copied"
                    ? "Copied"
                    : copyStatus === "error"
                      ? "Copy failed"
                      : "Copy JSON"}
                </button>
              </div>
              <pre className="scrollbar-thin h-[calc(100%-2.5rem)] overflow-auto p-4 font-mono text-xs leading-5 text-[hsl(180_50%_86%)]">
                {sceneJson}
              </pre>
            </div>
          ) : null}
        </section>
      </div>

      {showExamples ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(220_24%_8%/0.36)] px-4"
          onClick={() => setShowExamples(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="examples-title"
            className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-card shadow-soft"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </span>
                <h3 id="examples-title" className="text-sm font-semibold">
                  Examples
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowExamples(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
                title="Close examples"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-thin grid max-h-[min(62vh,520px)] gap-2 overflow-y-auto p-3">
              {promptChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => selectExample(chip)}
                  className="w-full rounded-md border border-border bg-white px-3 py-3 text-left text-sm leading-6 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
