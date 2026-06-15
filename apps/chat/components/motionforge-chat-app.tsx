"use client";

import {
  Check,
  ChevronRight,
  Copy,
  Download,
  FileJson,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import {
  disposeAssets,
  resolveAssets,
  type ResolvedAssets,
} from "@motionforge/renderer-canvas2d";
import type { Scene } from "@motionforge/schema";
import {
  deriveEditorLayers,
  displayLayerType,
  findEditorLayer,
  type EditorLayer,
} from "@/lib/editor/layers";
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

type EditorPanel = "chat" | "layers" | "inspector";

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
  const [activePanel, setActivePanel] = useState<EditorPanel>("chat");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
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
  const editorLayers = useMemo(
    () => (scene ? deriveEditorLayers(scene) : []),
    [scene],
  );
  const selectedLayer = useMemo(
    () => findEditorLayer(editorLayers, selectedLayerId),
    [editorLayers, selectedLayerId],
  );

  useEffect(() => {
    if (!scene) {
      setSelectedLayerId(null);
      return;
    }

    if (selectedLayerId && editorLayers.some((layer) => layer.id === selectedLayerId)) {
      return;
    }

    setSelectedLayerId(editorLayers[0]?.id ?? null);
  }, [editorLayers, scene, selectedLayerId]);

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
    setSelectedLayerId(null);
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
    <main className="h-[100dvh] min-h-0 overflow-hidden bg-[hsl(220_14%_96%)] text-foreground">
      <div className="grid h-full min-h-0 grid-cols-[56px_320px_minmax(0,1fr)] overflow-hidden">
        <ToolRail activePanel={activePanel} onPanelChange={setActivePanel} />

        <aside className="flex min-h-0 min-w-0 flex-col border-r border-border bg-card">
          <PanelSwitcher
            activePanel={activePanel}
            messages={messages}
            messagesScrollerRef={messagesScrollerRef}
            textareaRef={textareaRef}
            input={input}
            isSending={isSending}
            scene={scene}
            durationLabel={durationLabel}
            editorLayers={editorLayers}
            selectedLayer={selectedLayer}
            selectedLayerId={selectedLayerId}
            fps={scene?.fps ?? 30}
            onInputChange={setInput}
            onSubmitPrompt={submitPrompt}
            onShowExamples={() => setShowExamples(true)}
            onNewSession={startNewSession}
            onSelectLayer={setSelectedLayerId}
          />
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setActivePanel("chat")}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
                title="Open assistant"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold">motionforge editor</h1>
                <p className="truncate text-[11px] text-muted-foreground">
                  {scene
                    ? `${scene.width}x${scene.height} · ${scene.fps}fps · ${durationLabel} · ${editorLayers.length} layers`
                    : "New draft"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowJson((value) => !value)}
                disabled={!scene}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-white px-2.5 text-xs text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FileJson className="h-3.5 w-3.5" />
                {showJson ? "Hide JSON" : "JSON"}
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
                className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground shadow-sm hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Export
              </button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_156px] overflow-hidden">
            <PreviewWorkspace
              canvasRef={canvasRef}
              scene={scene}
              playerState={playerState}
            />

            <TimelinePanel
              scene={scene}
              layers={editorLayers}
              selectedLayerId={selectedLayerId}
              playerState={playerState}
              exportStatus={exportStatus}
              onSelectLayer={setSelectedLayerId}
              onTogglePlayback={togglePlayback}
              onSeek={seek}
            />
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

function ToolRail({
  activePanel,
  onPanelChange,
}: {
  activePanel: EditorPanel;
  onPanelChange: (panel: EditorPanel) => void;
}) {
  const items: Array<{ id: EditorPanel; label: string; icon: LucideIcon }> = [
    { id: "chat", label: "Assistant", icon: MessageSquare },
    { id: "layers", label: "Layers", icon: Layers },
    { id: "inspector", label: "Inspector", icon: Info },
  ];

  return (
    <nav className="flex min-h-0 flex-col items-center border-r border-border bg-[hsl(220_18%_12%)] py-2 text-white">
      <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-[hsl(186_80%_72%)]">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex flex-1 flex-col items-center gap-1">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPanelChange(item.id)}
            className={cn(
              "inline-flex h-10 w-10 items-center justify-center rounded-md text-white/62 transition",
              activePanel === item.id
                ? "bg-white text-[hsl(220_18%_12%)]"
                : "hover:bg-white/10 hover:text-white",
            )}
            title={item.label}
          >
            <item.icon className="h-4.5 w-4.5" />
          </button>
        ))}
      </div>
    </nav>
  );
}

function PanelSwitcher({
  activePanel,
  messages,
  messagesScrollerRef,
  textareaRef,
  input,
  isSending,
  scene,
  durationLabel,
  editorLayers,
  selectedLayer,
  selectedLayerId,
  fps,
  onInputChange,
  onSubmitPrompt,
  onShowExamples,
  onNewSession,
  onSelectLayer,
}: {
  activePanel: EditorPanel;
  messages: Message[];
  messagesScrollerRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  input: string;
  isSending: boolean;
  scene: Scene | null;
  durationLabel: string;
  editorLayers: EditorLayer[];
  selectedLayer: EditorLayer | null;
  selectedLayerId: string | null;
  fps: number;
  onInputChange: (value: string) => void;
  onSubmitPrompt: (value?: string) => Promise<void>;
  onShowExamples: () => void;
  onNewSession: () => void;
  onSelectLayer: (id: string) => void;
}) {
  if (activePanel === "layers") {
    return (
      <LayersPanel
        layers={editorLayers}
        selectedLayerId={selectedLayerId}
        onSelectLayer={onSelectLayer}
      />
    );
  }

  if (activePanel === "inspector") {
    return <InspectorPanel fps={fps} selectedLayer={selectedLayer} />;
  }

  return (
    <ChatPanel
      messages={messages}
      messagesScrollerRef={messagesScrollerRef}
      textareaRef={textareaRef}
      input={input}
      isSending={isSending}
      scene={scene}
      durationLabel={durationLabel}
      onInputChange={onInputChange}
      onSubmitPrompt={onSubmitPrompt}
      onShowExamples={onShowExamples}
      onNewSession={onNewSession}
    />
  );
}

function ChatPanel({
  messages,
  messagesScrollerRef,
  textareaRef,
  input,
  isSending,
  scene,
  durationLabel,
  onInputChange,
  onSubmitPrompt,
  onShowExamples,
  onNewSession,
}: {
  messages: Message[];
  messagesScrollerRef: RefObject<HTMLDivElement>;
  textareaRef: RefObject<HTMLTextAreaElement>;
  input: string;
  isSending: boolean;
  scene: Scene | null;
  durationLabel: string;
  onInputChange: (value: string) => void;
  onSubmitPrompt: (value?: string) => Promise<void>;
  onShowExamples: () => void;
  onNewSession: () => void;
}) {
  return (
    <>
      <PanelHeader
        icon={MessageSquare}
        title="Assistant"
        detail={scene ? durationLabel : "new draft"}
        action={
          <button
            type="button"
            onClick={onNewSession}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground"
            title="New session"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        }
      />
      <div
        ref={messagesScrollerRef}
        className="scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto p-3"
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(message.role === "user" ? "flex justify-end" : "")}
          >
            <div
              className={cn(
                "max-w-[92%] rounded-md px-3 py-2 text-sm leading-6",
                message.role === "user"
                  ? "bg-[hsl(220_18%_12%)] text-white"
                  : "border border-border bg-white text-foreground",
              )}
            >
              <div
                className={cn(
                  "mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase",
                  message.role === "user"
                    ? "justify-end text-white/65"
                    : "text-muted-foreground",
                )}
              >
                {message.role === "user" ? "You" : "Agent"}
                {message.source ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 normal-case text-muted-foreground">
                    {message.source}
                  </span>
                ) : null}
              </div>
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.diagnostics?.length ? (
                <pre className="mt-2 max-h-24 overflow-auto rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-800">
                  {message.diagnostics.join("\n")}
                </pre>
              ) : null}
            </div>
          </div>
        ))}
        {isSending ? (
          <div className="inline-flex items-center gap-2 rounded-md border border-primary/15 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking
          </div>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-border p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmitPrompt();
        }}
      >
        <div className="overflow-hidden rounded-md border border-border bg-white">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (input.trim() && !isSending) {
                  event.currentTarget.form?.requestSubmit();
                }
              }
            }}
            placeholder="Describe or refine the video..."
            rows={4}
            className="min-h-28 w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isSending}
          />
          <div className="flex items-center justify-between border-t border-border/70 px-2.5 py-2">
            <button
              type="button"
              onClick={onShowExamples}
              disabled={isSending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Examples
            </button>
            <button
              type="submit"
              disabled={!input.trim() || isSending}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[hsl(220_18%_12%)] px-3 text-xs font-medium text-white hover:bg-[hsl(220_18%_18%)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function LayersPanel({
  layers,
  selectedLayerId,
  onSelectLayer,
}: {
  layers: EditorLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
}) {
  return (
    <>
      <PanelHeader icon={Layers} title="Layers" detail={`${layers.length} nodes`} />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {layers.length ? (
          <div className="space-y-1">
            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                selected={selectedLayerId === layer.id}
                onSelect={() => onSelectLayer(layer.id)}
              />
            ))}
          </div>
        ) : (
          <EmptyPanelText text="Generate a scene to inspect editable layers." />
        )}
      </div>
    </>
  );
}

function InspectorPanel({
  fps,
  selectedLayer,
}: {
  fps: number;
  selectedLayer: EditorLayer | null;
}) {
  return (
    <>
      <PanelHeader icon={Info} title="Inspector" detail="selection" />
      {selectedLayer ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 p-3 text-sm">
          <InspectorField label="Id" value={selectedLayer.id} mono wide />
          <InspectorField
            label="Type"
            value={displayLayerType(selectedLayer.type)}
          />
          <InspectorField
            label="Start"
            value={`${selectedLayer.from}f · ${formatSeconds(selectedLayer.from, fps)}`}
          />
          <InspectorField
            label="Duration"
            value={`${selectedLayer.duration}f · ${formatSeconds(selectedLayer.duration, fps)}`}
          />
          <InspectorField label="zIndex" value={String(selectedLayer.zIndex)} />
          <InspectorField
            label="Parent"
            value={selectedLayer.parentId ?? "root"}
            mono={Boolean(selectedLayer.parentId)}
            wide
          />
          <InspectorField
            label="Bounds"
            value={formatBounds(selectedLayer.bounds)}
            wide
          />
        </dl>
      ) : (
        <EmptyPanelText text="Select a layer to inspect timing and geometry." />
      )}
    </>
  );
}

function PreviewWorkspace({
  canvasRef,
  scene,
  playerState,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
  scene: Scene | null;
  playerState: {
    loading: boolean;
    error: string | null;
  };
}) {
  return (
    <div
      className="relative min-h-0 min-w-0 overflow-hidden bg-[hsl(218_18%_92%)] bg-[linear-gradient(to_right,hsl(218_16%_82%/.55)_1px,transparent_1px),linear-gradient(to_bottom,hsl(218_16%_82%/.55)_1px,transparent_1px)] bg-[size:16px_16px]"
      data-editor-workspace
    >
      <div className="absolute inset-3 flex items-center justify-center">
        <div className="relative flex h-full max-h-full w-full items-center justify-center">
          <canvas
            ref={canvasRef}
            className="h-auto max-h-full w-auto max-w-full object-contain shadow-xl ring-1 ring-black/10"
            style={{
              aspectRatio: `${scene?.width ?? 1080} / ${scene?.height ?? 1920}`,
              background: "hsl(220 18% 12%)",
            }}
          />
          {!scene && !playerState.loading ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
              <div className="rounded-md bg-[hsl(220_18%_12%/.86)] px-5 py-4 text-white shadow-xl">
                <Sparkles className="mx-auto mb-2 h-5 w-5" />
                <p className="text-sm font-medium">New scene</p>
                <p className="mt-1 text-xs text-white/70">Start from Assistant.</p>
              </div>
            </div>
          ) : null}
          {playerState.loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : null}
          {playerState.error ? (
            <div className="absolute inset-x-6 top-6 rounded-md border border-destructive/30 bg-white p-3 text-sm text-destructive shadow-lg">
              {playerState.error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TimelinePanel({
  scene,
  layers,
  selectedLayerId,
  playerState,
  exportStatus,
  onSelectLayer,
  onTogglePlayback,
  onSeek,
}: {
  scene: Scene | null;
  layers: EditorLayer[];
  selectedLayerId: string | null;
  playerState: {
    frame: number;
    playing: boolean;
    loading: boolean;
    error: string | null;
    exportSupported: boolean;
  };
  exportStatus: string;
  onSelectLayer: (id: string) => void;
  onTogglePlayback: () => void;
  onSeek: (frame: number) => void;
}) {
  const duration = scene?.duration ?? 1;

  return (
    <div className="flex min-h-0 flex-col border-t border-border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!scene || playerState.loading || Boolean(playerState.error)}
            onClick={onTogglePlayback}
            className="inline-flex h-7 w-8 items-center justify-center rounded-md bg-muted text-foreground hover:bg-border disabled:cursor-not-allowed disabled:opacity-50"
            title={playerState.playing ? "Pause" : "Play"}
          >
            {playerState.playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </button>
          <output className="w-24 text-center font-mono text-xs tabular-nums text-foreground">
            {scene ? formatFrameTime(playerState.frame, scene.fps) : "00:00"}
          </output>
        </div>

        <input
          type="range"
          min={0}
          max={duration - 1}
          value={Math.min(playerState.frame, duration - 1)}
          disabled={!scene}
          onChange={(event) => onSeek(Number(event.target.value))}
          className="mx-4 h-1.5 flex-1 accent-[hsl(var(--primary))]"
        />

        <div className="w-56 truncate text-right text-xs text-muted-foreground">
          {playerState.exportSupported
            ? scene
              ? exportStatus || `${layers.length} layers`
              : "Start with Assistant"
            : "WebCodecs VideoEncoder required"}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[164px_minmax(0,1fr)] overflow-hidden">
        <div className="border-r border-border bg-[hsl(220_14%_98%)]">
          <div className="h-6 border-b border-border px-3 text-[10px] font-semibold uppercase leading-6 text-muted-foreground">
            Tracks
          </div>
          <div className="scrollbar-thin max-h-[calc(100%-1.5rem)] overflow-y-auto">
            {layers.length ? (
              layers.slice(0, 4).map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onSelectLayer(layer.id)}
                  className={cn(
                    "flex h-8 w-full items-center gap-2 border-b border-border/70 px-3 text-left text-xs",
                    selectedLayerId === layer.id
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  <span className="truncate">{layer.label}</span>
                </button>
              ))
            ) : (
              <div className="px-3 py-4 text-xs leading-5 text-muted-foreground">
                No tracks yet.
              </div>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(214_18%_86%/.8)_1px,transparent_1px)] bg-[size:64px_100%]" />
          <div
            className="absolute bottom-0 top-0 w-px bg-accent"
            style={{
              left: `${scene ? (playerState.frame / Math.max(1, duration - 1)) * 100 : 0}%`,
            }}
          />
          <div className="relative pt-6">
            {layers.length ? (
              layers.slice(0, 4).map((layer, index) => (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => onSelectLayer(layer.id)}
                  className={cn(
                    "absolute h-6 rounded-md border px-2 text-left text-[11px] font-medium shadow-sm transition",
                    selectedLayerId === layer.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-primary/30 bg-primary/15 text-primary hover:bg-primary/20",
                  )}
                  style={{
                    top: `${index * 32 + 4}px`,
                    left: `${(layer.from / duration) * 100}%`,
                    width: `${Math.max(4, (layer.duration / duration) * 100)}%`,
                  }}
                >
                  <span className="block truncate">{layer.label}</span>
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-xs text-muted-foreground">
                Generated layers will appear on the timeline.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LayerRow({
  layer,
  selected,
  onSelect,
}: {
  layer: EditorLayer;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border px-2 py-2 text-left transition",
        selected
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-transparent bg-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground",
      )}
      style={{ paddingLeft: `${8 + layer.depth * 14}px` }}
    >
      <ChevronRight
        className={cn(
          "h-3.5 w-3.5 shrink-0",
          layer.childCount ? "opacity-80" : "opacity-0",
        )}
      />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{layer.label}</span>
        <span className="mt-0.5 block truncate text-[10px] uppercase text-muted-foreground">
          {displayLayerType(layer.type)} · {layer.id}
        </span>
      </span>
      <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
        {layer.from}
      </span>
    </button>
  );
}

function PanelHeader({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-semibold">{title}</span>
      </div>
      <span className="truncate pl-2 text-[11px] text-muted-foreground">
        {detail}
      </span>
      {action ? <div className="ml-2 shrink-0">{action}</div> : null}
    </div>
  );
}

function InspectorField({
  label,
  value,
  mono = false,
  wide = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={cn(wide ? "col-span-2" : "min-w-0")}>
      <dt className="mb-1 text-[11px] font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "min-h-8 overflow-hidden rounded-md border border-border bg-muted/45 px-2 py-1.5 text-foreground",
          mono ? "font-mono text-xs" : "text-sm",
        )}
        title={value}
      >
        <span className="block truncate">{value}</span>
      </dd>
    </div>
  );
}

function EmptyPanelText({ text }: { text: string }) {
  return (
    <div className="flex h-full min-h-32 items-center justify-center p-6 text-center text-sm leading-6 text-muted-foreground">
      {text}
    </div>
  );
}

function formatSeconds(frames: number, fps: number): string {
  return `${(frames / fps).toFixed(2)}s`;
}

function formatFrameTime(frame: number, fps: number): string {
  const totalSeconds = Math.max(0, Math.floor(frame / fps));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatBounds(bounds: EditorLayer["bounds"]): string {
  if (!bounds) {
    return "no numeric bounds";
  }

  return [
    bounds.left === undefined ? null : `x ${bounds.left}`,
    bounds.top === undefined ? null : `y ${bounds.top}`,
    bounds.width === undefined ? null : `w ${bounds.width}`,
    bounds.height === undefined ? null : `h ${bounds.height}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
