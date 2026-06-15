export type EditorPanel = "chat" | "layers" | "inspector";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: "local" | "model";
  diagnostics?: string[];
};

export type PlayerUiState = {
  loading: boolean;
  frame: number;
  playing: boolean;
  error: string | null;
  exportSupported: boolean;
};
