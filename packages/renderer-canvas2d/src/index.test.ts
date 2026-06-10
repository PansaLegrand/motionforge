import { describe, expect, it } from "vitest";
import { sampleScene } from "@motionforge/core";
import { renderStill, wrapTextLines } from "./index.js";

// Deterministic fake measurer: every character is 10px wide.
const measure = (line: string): number => line.length * 10;

describe("renderStill", () => {
  it("exports a callable browser renderer", () => {
    expect(typeof renderStill).toBe("function");
    expect(sampleScene().width).toBe(1080);
  });
});

describe("wrapTextLines", () => {
  it("keeps short text on a single line", () => {
    expect(wrapTextLines("hello world", 200, measure)).toEqual(["hello world"]);
  });

  it("always breaks on explicit newlines", () => {
    expect(wrapTextLines("one\ntwo three", 1000, measure)).toEqual([
      "one",
      "two three",
    ]);
  });

  it("preserves empty lines from consecutive newlines", () => {
    expect(wrapTextLines("one\n\ntwo", 1000, measure)).toEqual([
      "one",
      "",
      "two",
    ]);
  });

  it("wraps words when a line would exceed maxWidth", () => {
    // "aaaa bbbb" measures 90px; maxWidth 50 fits one 4-char word per line.
    expect(wrapTextLines("aaaa bbbb cccc", 50, measure)).toEqual([
      "aaaa",
      "bbbb",
      "cccc",
    ]);
  });

  it("packs as many words as fit before breaking", () => {
    expect(wrapTextLines("aa bb cc dd", 60, measure)).toEqual([
      "aa bb",
      "cc dd",
    ]);
  });

  it("gives an overlong single word its own line instead of looping", () => {
    expect(wrapTextLines("tiny enormousword tiny", 60, measure)).toEqual([
      "tiny",
      "enormousword",
      "tiny",
    ]);
  });

  it("collapses runs of whitespace like HTML text rendering", () => {
    expect(wrapTextLines("one   two", 1000, measure)).toEqual(["one two"]);
  });
});
