"use client";

import {
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  PanelLeftClose,
  Redo2,
  Undo2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import {
  disposeAssets,
  resolveAssets,
  type ResolvedAssets,
} from "@motionforge/renderer-canvas2d";
import {
  applyScenePatch,
  type Scene,
  type ScenePatch,
} from "@motionforge/schema";
import {
  createInspectorPatch,
  type InspectorEditableField,
} from "@/lib/editor/inspector-patches";
import { deriveEditorLayers, findEditorLayer } from "@/lib/editor/layers";
import {
  createSceneHistory,
  recordSceneHistory,
  redoSceneHistory,
  undoSceneHistory,
  type SceneHistory,
} from "@/lib/editor/scene-history";
import {
  PanelSwitcher,
  PreviewWorkspace,
  TimelinePanel,
  ToolRail,
} from "@/components/editor/editor-workspace";
import { ExamplesDialog } from "@/components/editor/examples-dialog";
import type {
  ChatMessage,
  EditorPanel,
  PlayerUiState,
} from "@/components/editor/types";
import { promptChips } from "@/lib/motionforge/examples";
import type { MotionforgeAgentResult } from "@/lib/motionforge/local-agent";
import {
  cloneReadmeShowcaseScene,
  readmeShowcaseExamples,
  type ReadmeShowcaseExample,
} from "@/lib/motionforge/readme-showcases";

type ChatApiResponse =
  | { ok: true; result: MotionforgeAgentResult }
  | { ok: false; error: string };

const initialMessages: ChatMessage[] = [
  {
    id: "new-session",
    role: "assistant",
    content: "New session ready. Describe a video to generate the first scene.",
    source: "local",
  },
];

type SceneChangeSource = "assistant" | "showcase" | "inspector";

export function MotionforgeChatApp() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [sceneHistory, setSceneHistory] = useState<SceneHistory>(() =>
    createSceneHistory(),
  );
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
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
  const [lastPatch, setLastPatch] = useState<ScenePatch | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [playerState, setPlayerState] = useState<PlayerUiState>({
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
  const canUndo = Boolean(scene && sceneHistory.past.length);
  const canRedo = Boolean(scene && sceneHistory.future.length);

  useEffect(() => {
    if (!scene) {
      setSelectedLayerId(null);
      return;
    }

    if (
      selectedLayerId &&
      editorLayers.some((layer) => layer.id === selectedLayerId)
    ) {
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

  const commitSceneChange = useCallback(
    (nextScene: Scene, source: SceneChangeSource) => {
      setSceneHistory((history) => recordSceneHistory(history, scene));
      setScene(nextScene);
      setExportStatus("");

      if (source !== "inspector") {
        setEditorError(null);
      }
    },
    [scene],
  );

  const undoSceneChange = useCallback(() => {
    const result = undoSceneHistory(scene, sceneHistory);

    if (!result.changed) {
      return;
    }

    setScene(result.scene);
    setSceneHistory(result.history);
    setLastPatch(null);
    setEditorError(null);
    setExportStatus("");
  }, [scene, sceneHistory]);

  const redoSceneChange = useCallback(() => {
    const result = redoSceneHistory(scene, sceneHistory);

    if (!result.changed) {
      return;
    }

    setScene(result.scene);
    setSceneHistory(result.history);
    setLastPatch(null);
    setEditorError(null);
    setExportStatus("");
  }, [scene, sceneHistory]);

  const submitPrompt = useCallback(
    async (value?: string) => {
      const instruction = (value ?? input).trim();

      if (!instruction || isSending) {
        return;
      }

      setInput("");
      setIsSending(true);
      setExportStatus("");
      setEditorError(null);
      const userMessage: ChatMessage = {
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

        commitSceneChange(payload.result.scene, "assistant");
        setLastPatch(payload.result.patch ?? null);
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
    [commitSceneChange, input, isSending, messages, scene],
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
    setSceneHistory(createSceneHistory());
    setSelectedLayerId(null);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          "New session ready. Describe a video to generate the first scene.",
        source: "local",
      },
    ]);
    setInput("");
    setExportStatus("");
    setLastPatch(null);
    setEditorError(null);
    setShowJson(false);
  }, []);

  const editSelectedLayer = useCallback(
    (id: string, field: InspectorEditableField, value: string) => {
      if (!scene) {
        setEditorError("Create or load a scene before editing.");
        return;
      }

      const patchResult = createInspectorPatch(id, field, value);

      if (!patchResult.ok) {
        setEditorError(patchResult.error);
        return;
      }

      const result = applyScenePatch(scene, patchResult.patch);

      if (!result.ok) {
        setEditorError(result.errors.map((error) => error.message).join("\n"));
        return;
      }

      commitSceneChange(result.scene, "inspector");
      setLastPatch(patchResult.patch);
      setEditorError(null);
      setExportStatus("");
    },
    [commitSceneChange, scene],
  );

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

  const loadReadmeShowcase = useCallback((example: ReadmeShowcaseExample) => {
    commitSceneChange(cloneReadmeShowcaseScene(example), "showcase");
    setSelectedLayerId(null);
    setExportStatus("");
    setCopyStatus("idle");
    setLastPatch(null);
    setEditorError(null);
    setShowJson(false);
    setShowExamples(false);
    setActivePanel("layers");
    setMessages((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Loaded README showcase scene: ${example.title}.`,
        source: "local",
        diagnostics: [`Source JSON: ${example.jsonPath}`],
      },
    ]);
  }, [commitSceneChange]);

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
            onEditLayer={editSelectedLayer}
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
                <h1 className="truncate text-sm font-semibold">
                  motionforge editor
                </h1>
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
                onClick={undoSceneChange}
                disabled={!canUndo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Undo"
                title="Undo"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={redoSceneChange}
                disabled={!canRedo}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Redo"
                title="Redo"
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
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
          {editorError || lastPatch ? (
            <div className="flex h-10 shrink-0 items-center gap-3 border-t border-border bg-card px-4 text-xs">
              {editorError ? (
                <span className="min-w-0 truncate text-destructive">
                  {editorError}
                </span>
              ) : (
                <>
                  <span className="shrink-0 font-medium uppercase text-muted-foreground">
                    Last patch
                  </span>
                  <code className="min-w-0 truncate rounded bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground">
                    {JSON.stringify(lastPatch)}
                  </code>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>

      {showExamples ? (
        <ExamplesDialog
          prompts={promptChips}
          showcases={readmeShowcaseExamples}
          onSelectPrompt={selectExample}
          onLoadShowcase={loadReadmeShowcase}
          onClose={() => setShowExamples(false)}
        />
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
