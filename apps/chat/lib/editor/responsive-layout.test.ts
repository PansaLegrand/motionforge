import { describe, expect, it } from "vitest";
import {
  desktopLayoutMinWidth,
  getEditorLayoutMode,
  panelRowHeight,
} from "./responsive-layout";

describe("responsive editor layout", () => {
  it("uses stacked layout below the desktop breakpoint", () => {
    expect(getEditorLayoutMode(390)).toBe("stacked");
    expect(getEditorLayoutMode(desktopLayoutMinWidth - 1)).toBe("stacked");
    expect(panelRowHeight(390)).toBe("34dvh");
  });

  it("keeps the existing desktop layout at large widths", () => {
    expect(getEditorLayoutMode(desktopLayoutMinWidth)).toBe("desktop");
    expect(getEditorLayoutMode(1440)).toBe("desktop");
    expect(panelRowHeight(1440)).toBe("full-height");
  });
});
