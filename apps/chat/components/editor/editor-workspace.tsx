import {
  ChevronRight,
  Info,
  Layers,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  Plus,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode, RefObject } from "react";
import type { Scene } from "@motionforge/schema";
import {
  describeExportReadiness,
  describePreviewOverlay,
} from "@/lib/editor/capability-messages";
import type { InspectorEditableField } from "@/lib/editor/inspector-patches";
import { displayLayerType, type EditorLayer } from "@/lib/editor/layers";
import { formatFrameTime, formatSeconds } from "@/lib/editor/time";
import { cn } from "@/lib/ui/cn";
import type { ChatMessage, EditorPanel, PlayerUiState } from "./types";

export function ToolRail({
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
    <nav className="col-span-full flex min-h-0 shrink-0 items-center border-b border-border bg-[hsl(220_18%_12%)] px-2 py-1 text-white lg:col-span-1 lg:row-span-full lg:flex-col lg:border-b-0 lg:border-r lg:px-0 lg:py-2">
      <div className="mr-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-[hsl(186_80%_72%)] lg:mb-3 lg:mr-0 lg:h-9 lg:w-9">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="flex flex-1 items-center gap-1 lg:flex-col">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPanelChange(item.id)}
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-md text-white/62 transition lg:h-10 lg:w-10",
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

export function PanelSwitcher({
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
  onEditLayer,
}: {
  activePanel: EditorPanel;
  messages: ChatMessage[];
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
  onEditLayer: (
    id: string,
    field: InspectorEditableField,
    value: string,
  ) => void;
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
    return (
      <InspectorPanel
        fps={fps}
        selectedLayer={selectedLayer}
        onEditLayer={onEditLayer}
      />
    );
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
  messages: ChatMessage[];
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
      <PanelHeader
        icon={Layers}
        title="Layers"
        detail={`${layers.length} nodes`}
      />
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
  onEditLayer,
}: {
  fps: number;
  selectedLayer: EditorLayer | null;
  onEditLayer: (
    id: string,
    field: InspectorEditableField,
    value: string,
  ) => void;
}) {
  return (
    <>
      <PanelHeader icon={Info} title="Inspector" detail="selection" />
      {selectedLayer ? (
        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-3">
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <InspectorField label="Id" value={selectedLayer.id} mono wide />
            <InspectorField
              label="Type"
              value={displayLayerType(selectedLayer.type)}
            />
            {selectedLayer.type === "text" ? (
              <>
                <InspectorTextArea
                  label="Text"
                  value={selectedLayer.text ?? ""}
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "text", value)
                  }
                />
                <InspectorTextInput
                  label="Color"
                  value={selectedLayer.color ?? ""}
                  placeholder="#ffffff"
                  swatch
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "color", value)
                  }
                />
                <InspectorTextInput
                  label="Font size"
                  value={formatOptionalStyleValue(selectedLayer.fontSize)}
                  placeholder="default"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "fontSize", value)
                  }
                />
                <InspectorTextInput
                  label="Font weight"
                  value={formatOptionalStyleValue(selectedLayer.fontWeight)}
                  placeholder="default"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "fontWeight", value)
                  }
                />
                <InspectorSelectInput
                  label="Align"
                  value={selectedLayer.textAlign ?? ""}
                  options={[
                    { label: "Default", value: "" },
                    { label: "Left", value: "left" },
                    { label: "Center", value: "center" },
                    { label: "Right", value: "right" },
                  ]}
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "textAlign", value)
                  }
                />
                <InspectorTextInput
                  label="Stroke"
                  value={selectedLayer.textStroke ?? ""}
                  placeholder="4px #000000"
                  onCommit={(value) =>
                    onEditLayer(selectedLayer.id, "textStroke", value)
                  }
                />
              </>
            ) : null}
            <InspectorNumberInput
              label="Start"
              value={String(selectedLayer.localFrom)}
              suffix={`${formatSeconds(selectedLayer.localFrom, fps)} local`}
              onCommit={(value) => onEditLayer(selectedLayer.id, "from", value)}
            />
            <InspectorNumberInput
              label="Duration"
              value={String(selectedLayer.localDuration)}
              suffix={`${formatSeconds(selectedLayer.localDuration, fps)} local`}
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "duration", value)
              }
            />
            <InspectorNumberInput
              label="Left"
              value={formatOptionalNumber(selectedLayer.bounds?.left)}
              onCommit={(value) => onEditLayer(selectedLayer.id, "left", value)}
            />
            <InspectorNumberInput
              label="Top"
              value={formatOptionalNumber(selectedLayer.bounds?.top)}
              onCommit={(value) => onEditLayer(selectedLayer.id, "top", value)}
            />
            <InspectorNumberInput
              label="Width"
              value={formatOptionalNumber(selectedLayer.bounds?.width)}
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "width", value)
              }
            />
            <InspectorNumberInput
              label="Height"
              value={formatOptionalNumber(selectedLayer.bounds?.height)}
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "height", value)
              }
            />
            <InspectorNumberInput
              label="Opacity"
              value={formatOptionalNumber(selectedLayer.opacity)}
              placeholder="default"
              step="0.05"
              min="0"
              max="1"
              onCommit={(value) =>
                onEditLayer(selectedLayer.id, "opacity", value)
              }
            />
            <InspectorField
              label="zIndex"
              value={String(selectedLayer.zIndex)}
            />
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
        </div>
      ) : (
        <EmptyPanelText text="Select a layer to inspect timing and geometry." />
      )}
    </>
  );
}

export function PreviewWorkspace({
  canvasRef,
  scene,
  playerState,
}: {
  canvasRef: RefObject<HTMLCanvasElement>;
  scene: Scene | null;
  playerState: Pick<PlayerUiState, "loading" | "error">;
}) {
  const overlay = describePreviewOverlay({
    hasScene: Boolean(scene),
    previewLoading: playerState.loading,
    previewError: playerState.error,
  });

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
          {overlay?.kind === "empty" ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center">
              <div className="rounded-md bg-[hsl(220_18%_12%/.86)] px-5 py-4 text-white shadow-xl">
                <Sparkles className="mx-auto mb-2 h-5 w-5" />
                <p className="text-sm font-medium">{overlay.title}</p>
                <p className="mt-1 text-xs text-white/70">
                  {overlay.detail}
                </p>
              </div>
            </div>
          ) : null}
          {playerState.loading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
              <Loader2 className="h-7 w-7 animate-spin" />
            </div>
          ) : null}
          {overlay?.kind === "error" ? (
            <div className="absolute inset-x-6 top-6 rounded-md border border-destructive/30 bg-white p-3 text-sm text-destructive shadow-lg">
              <p className="font-semibold">{overlay.title}</p>
              <p className="mt-1 leading-5">{overlay.detail}</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TimelinePanel({
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
  playerState: PlayerUiState;
  exportStatus: string;
  onSelectLayer: (id: string) => void;
  onTogglePlayback: () => void;
  onSeek: (frame: number) => void;
}) {
  const duration = scene?.duration ?? 1;
  const exportReadiness = describeExportReadiness({
    hasScene: Boolean(scene),
    previewLoading: playerState.loading,
    previewError: playerState.error,
    exportSupported: playerState.exportSupported,
    isExporting: false,
    exportStatus,
    layerCount: layers.length,
  });

  return (
    <div className="flex min-h-0 flex-col border-t border-border bg-card">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={
              !scene || playerState.loading || Boolean(playerState.error)
            }
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

        <div className="hidden w-40 truncate text-right text-xs text-muted-foreground sm:block lg:w-56">
          {exportReadiness.status}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[120px_minmax(0,1fr)] overflow-hidden sm:grid-cols-[164px_minmax(0,1fr)]">
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
                    "flex h-8 w-full items-center gap-2 border-b border-border/70 px-2 text-left text-xs sm:px-3",
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
              <div className="px-2 py-4 text-xs leading-5 text-muted-foreground sm:px-3">
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
              <div className="px-3 py-6 text-xs text-muted-foreground sm:px-4 sm:py-8">
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
        <span className="block truncate text-sm font-medium">
          {layer.label}
        </span>
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
  action?: ReactNode;
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

function InspectorTextArea({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="col-span-2">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <textarea
        id={fieldId}
        defaultValue={value}
        key={value}
        rows={3}
        onBlur={(event) => {
          if (event.currentTarget.value !== value) {
            onCommit(event.currentTarget.value);
          }
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="min-h-20 w-full resize-none rounded-md border border-border bg-white px-2 py-1.5 text-sm leading-5 text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

function InspectorTextInput({
  label,
  value,
  placeholder,
  swatch = false,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  swatch?: boolean;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="min-w-0">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <div className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-2 focus-within:border-primary">
        {swatch ? (
          <span
            className="h-4 w-4 shrink-0 rounded-sm border border-border"
            style={{ background: value || "transparent" }}
          />
        ) : null}
        <input
          id={fieldId}
          type="text"
          defaultValue={value}
          key={value}
          placeholder={placeholder}
          onBlur={(event) => {
            if (event.currentTarget.value !== value) {
              onCommit(event.currentTarget.value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 border-0 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}

function InspectorNumberInput({
  label,
  value,
  suffix,
  placeholder,
  step = "1",
  min,
  max,
  onCommit,
}: {
  label: string;
  value: string;
  suffix?: string;
  placeholder?: string;
  step?: string;
  min?: string;
  max?: string;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="min-w-0">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <input
        id={fieldId}
        type="number"
        defaultValue={value}
        key={value}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        onBlur={(event) => {
          if (event.currentTarget.value !== value) {
            onCommit(event.currentTarget.value);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-full rounded-md border border-border bg-white px-2 font-mono text-xs text-foreground outline-none focus:border-primary"
      />
      {suffix ? (
        <div className="mt-1 truncate text-[10px] text-muted-foreground">
          {suffix}
        </div>
      ) : null}
    </div>
  );
}

function InspectorSelectInput({
  label,
  value,
  options,
  onCommit,
}: {
  label: string;
  value: string;
  options: Array<{ label: string; value: string }>;
  onCommit: (value: string) => void;
}) {
  const fieldId = inspectorFieldId(label);

  return (
    <div className="min-w-0">
      <label
        htmlFor={fieldId}
        className="mb-1 block text-[11px] font-medium uppercase text-muted-foreground"
      >
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onCommit(event.currentTarget.value)}
        className="h-8 w-full rounded-md border border-border bg-white px-2 text-xs text-foreground outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
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

function formatOptionalNumber(value: number | undefined): string {
  return value === undefined ? "" : String(value);
}

function formatOptionalStyleValue(value: number | string | undefined): string {
  return value === undefined ? "" : String(value);
}

function inspectorFieldId(label: string): string {
  return `inspector-${label.toLowerCase().replace(/\s+/g, "-")}`;
}
