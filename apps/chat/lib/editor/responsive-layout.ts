export type EditorLayoutMode = "stacked" | "desktop";

export const desktopLayoutMinWidth = 1024;

export function getEditorLayoutMode(width: number): EditorLayoutMode {
  return width >= desktopLayoutMinWidth ? "desktop" : "stacked";
}

export function panelRowHeight(width: number): string {
  return getEditorLayoutMode(width) === "desktop" ? "full-height" : "34dvh";
}
