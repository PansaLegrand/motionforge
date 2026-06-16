import type { MediaOperationPlan } from "../../lib/media/plan";

export type EditorPanel = "chat" | "assets" | "layers" | "inspector";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "local" | "model";
  diagnostics?: string[];
  mediaPlan?: MediaOperationPlan;
};

export type PlayerUiState = {
  loading: boolean;
  frame: number;
  playing: boolean;
  error: string | null;
  exportSupported: boolean;
};
