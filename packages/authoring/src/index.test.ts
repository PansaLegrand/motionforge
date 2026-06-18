import { describe, expect, it } from "vitest";
import { validateScene } from "@motionforge/schema";
import {
  audioTrack,
  audioAsset,
  bg,
  captionTrack,
  defineAssets,
  fadeUp,
  frames,
  image,
  imageAsset,
  makeScene,
  parseSrt,
  parseVtt,
  publicAsset,
  seconds,
  subtitleTrack,
  textBlock,
  textBox,
  title,
  toFrames,
  toSeconds,
  videoAsset,
  videoClip,
} from "./index.js";

describe("@motionforge/authoring", () => {
  it("builds a valid portrait scene with seconds-based timing", () => {
    const scene = makeScene({
      size: "portrait",
      fps: 30,
      duration: seconds(5),
      children: [
        bg("#0f172a", { id: "bg" }),
        title("Hello MotionForge", {
          id: "title",
          at: seconds(0.5),
          duration: seconds(3),
          enter: fadeUp({ durationInFrames: 12 }),
        }),
        textBlock("Video as deterministic TypeScript data.", {
          id: "subtitle",
          at: frames(42),
        }),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene).toMatchObject({
      width: 1080,
      height: 1920,
      fps: 30,
      duration: 150,
    });
    expect(scene.nodes[1]).toMatchObject({
      id: "title",
      from: 15,
      duration: 90,
      type: "text",
      text: "Hello MotionForge",
      animations: [
        { kind: "keyframes", property: "transform" },
        { kind: "keyframes", property: "opacity" },
      ],
    });
    expect(scene.nodes[1]?.style).toMatchObject({
      left: 72,
      right: 72,
      top: 720,
      fontSize: 88,
    });
    expect(scene.nodes[2]).toMatchObject({
      id: "subtitle",
      from: 42,
    });
  });

  it("builds media nodes with source trims and scene assets", () => {
    const poster = imageAsset("poster", publicAsset("assets/poster.png"));
    const clip = videoAsset("clip", publicAsset("public/assets/clip.mp4"));

    const scene = makeScene({
      size: "landscape",
      fps: 24,
      duration: seconds(4),
      assets: defineAssets(audioAsset("music", "/music.mp3")),
      children: [
        image(poster, { id: "poster-node", duration: seconds(1) }),
        videoClip(clip, {
          id: "clip-node",
          at: seconds(1),
          duration: seconds(2),
          trimStart: seconds(5),
          playbackRate: 1.25,
          volume: 0.5,
        }),
        audioTrack("music", {
          id: "music-node",
          trimStart: seconds(10),
          volume: 0.25,
        }),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.assets).toMatchObject({
      poster: { id: "poster", type: "image", src: "/assets/poster.png" },
      clip: { id: "clip", type: "video", src: "/assets/clip.mp4" },
      music: { id: "music", type: "audio", src: "/music.mp3" },
    });
    expect(scene.nodes[1]).toMatchObject({
      id: "clip-node",
      type: "video",
      from: 24,
      duration: 48,
      videoStartTime: 5,
      playbackRate: 1.25,
      volume: 0.5,
    });
    expect(scene.nodes[2]).toMatchObject({
      id: "music-node",
      type: "audio",
      audioStartTime: 10,
      volume: 0.25,
    });
  });

  it("normalizes public asset paths and rejects paths outside public", () => {
    expect(publicAsset("assets/logo.svg")).toBe("/assets/logo.svg");
    expect(publicAsset("./public/assets/logo.svg")).toBe("/assets/logo.svg");
    expect(publicAsset("/assets/logo.svg")).toBe("/assets/logo.svg");
    expect(publicAsset("https://cdn.example.com/logo.svg")).toBe(
      "https://cdn.example.com/logo.svg",
    );
    expect(() => publicAsset("../secret.mov")).toThrow("public");
  });

  it("uses scene-relative text defaults across aspect ratios", () => {
    const scene = makeScene({
      size: "landscape",
      fps: 30,
      duration: seconds(3),
      children: [
        title("Landscape Title", { id: "title" }),
        textBlock("Landscape body", { id: "body" }),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.nodes[0]?.style).toMatchObject({
      left: 129,
      right: 129,
      top: 405,
      fontSize: 50,
    });
    expect(scene.nodes[1]?.style).toMatchObject({
      left: 129,
      right: 129,
      top: 529,
      fontSize: 24,
    });
  });

  it("builds robust bounded text boxes with placement defaults", () => {
    const scene = makeScene({
      size: "portrait",
      fps: 30,
      duration: seconds(3),
      children: [
        textBox("A very long title that should stay readable in a safe box", {
          id: "title-box",
          placement: "title",
          maxLines: 2,
        }),
        textBox("Speaker name and role", {
          id: "lower-third",
          placement: "lowerThird",
          safeArea: { x: 96, y: 128 },
          fit: "truncate",
          minFontSize: 28,
        }),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.nodes[0]).toMatchObject({
      id: "title-box",
      type: "text",
      text: "A very long title that should stay readable in a safe box",
      style: {
        left: 72,
        top: 240,
        width: 936,
        height: 346,
        overflow: "hidden",
        textFit: "shrink",
        textOverflow: "ellipsis",
        maxLines: 2,
        fontSize: 100,
        minFontSize: 55,
      },
    });
    expect(scene.nodes[1]).toMatchObject({
      id: "lower-third",
      style: {
        left: 96,
        top: 1274,
        width: 657,
        height: 288,
        textAlign: "left",
        textFit: "truncate",
        minFontSize: 28,
        maxLines: 2,
      },
    });
  });

  it("lets text box style overrides keep manual control", () => {
    const scene = makeScene({
      size: "square",
      duration: seconds(2),
      children: [
        textBox("Manual caption", {
          id: "manual",
          placement: "bottom",
          safeArea: false,
          style: {
            left: 24,
            top: 900,
            width: 512,
            height: 80,
            fontSize: 34,
            textAlign: "left",
            textFit: "wrap",
            textOverflow: "clip",
            maxLines: 1,
          },
        }),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.nodes[0]?.style).toMatchObject({
      left: 24,
      top: 900,
      width: 512,
      height: 80,
      fontSize: 34,
      textAlign: "left",
      textFit: "wrap",
      textOverflow: "clip",
      maxLines: 1,
    });
  });

  it("builds safe subtitle tracks from parsed SRT cues", () => {
    const scene = makeScene({
      size: "portrait",
      fps: 30,
      duration: seconds(5),
      children: [
        bg("#111827"),
        subtitleTrack(
          parseSrt(`1
00:00:00,500 --> 00:00:02,000
Hello from SRT

2
00:00:02,250 --> 00:00:04,500
Second subtitle line
with an intentional break`),
          {
            idPrefix: "subs",
            template: "minimalBar",
            maxLines: 2,
          },
        ),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.nodes[1]).toMatchObject({
      id: "subs",
      type: "div",
      style: {
        left: 72,
        top: 1316,
        width: 936,
        height: 230,
      },
    });
    expect(scene.nodes[1]?.children?.[0]).toMatchObject({
      id: "subs-s0",
      from: 15,
      duration: 45,
    });
    expect(scene.nodes[1]?.children?.[0]?.children?.[0]).toMatchObject({
      type: "text",
      text: "Hello from SRT",
      style: {
        overflow: "hidden",
        textFit: "shrink",
        textOverflow: "ellipsis",
        maxLines: 2,
      },
    });
  });

  it("builds subtitle tracks from parsed VTT cues with manual placement", () => {
    const scene = makeScene({
      size: "landscape",
      fps: 24,
      duration: seconds(4),
      children: [
        subtitleTrack(
          parseVtt(`WEBVTT

00:00:00.000 --> 00:00:01.500 align:center
Hello from VTT`),
          {
            idPrefix: "manual-vtt",
            area: { top: "66%", height: "18%" },
            style: { fontSize: 44 },
          },
        ),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.nodes[0]).toMatchObject({
      id: "manual-vtt",
      style: {
        top: "66%",
        height: "18%",
      },
    });
  });

  it("builds word-timed caption tracks for ASR output", () => {
    const scene = makeScene({
      size: "portrait",
      fps: 30,
      duration: seconds(3),
      children: [
        captionTrack(
          [
            { word: "Fast", startMs: 0, endMs: 400 },
            { word: "caption", startMs: 420, endMs: 920 },
            { word: "track", startMs: 940, endMs: 1320 },
          ],
          {
            idPrefix: "asr-captions",
            template: "spotlight",
            renderMode: "word",
          },
        ),
      ],
    });

    expect(validateScene(scene)).toMatchObject({ ok: true });
    expect(scene.nodes[0]).toMatchObject({
      id: "asr-captions",
      type: "div",
    });
    expect(scene.nodes[0]?.children).toHaveLength(3);
    expect(scene.nodes[0]?.children?.[0]).toMatchObject({
      id: "asr-captions-w0",
      from: 0,
      duration: 13,
      children: [{ type: "text", text: "Fast" }],
    });
  });

  it("converts time values deterministically", () => {
    expect(toFrames(seconds(2.5), 30)).toBe(75);
    expect(toFrames(frames(12), 30)).toBe(12);
    expect(toSeconds(seconds(2.5), 30)).toBe(2.5);
    expect(toSeconds(frames(75), 30)).toBe(2.5);
  });
});
