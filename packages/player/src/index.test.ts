import { describe, expect, it } from "vitest";
import { createPlayer, FrameClock } from "./index.js";

describe("FrameClock", () => {
  const clock = (overrides: Partial<{ fps: number; durationInFrames: number; loop: boolean }> = {}) =>
    new FrameClock({ fps: 30, durationInFrames: 90, ...overrides });

  it("maps elapsed wall time to frames while playing", () => {
    const c = clock();
    c.play(1000);

    expect(c.frameAt(1000)).toEqual({ frame: 0, ended: false });
    expect(c.frameAt(1033)).toEqual({ frame: 0, ended: false }); // 0.99 frames
    expect(c.frameAt(1034)).toEqual({ frame: 1, ended: false });
    expect(c.frameAt(2000)).toEqual({ frame: 30, ended: false });
    expect(c.frameAt(3999)).toEqual({ frame: 89, ended: false });
  });

  it("holds the anchor frame while paused", () => {
    const c = clock();
    c.play(0);
    c.pause(1000); // frame 30

    expect(c.frameAt(99999)).toEqual({ frame: 30, ended: false });

    c.play(5000);
    expect(c.frameAt(6000)).toEqual({ frame: 60, ended: false });
  });

  it("clamps to the final frame and reports ended without looping", () => {
    const c = clock();
    c.play(0);

    expect(c.frameAt(3000)).toEqual({ frame: 89, ended: true });
    expect(c.frameAt(60000)).toEqual({ frame: 89, ended: true });
  });

  it("wraps with loop enabled and never reports ended", () => {
    const c = clock({ loop: true });
    c.play(0);

    expect(c.frameAt(3000)).toEqual({ frame: 0, ended: false }); // frame 90 → 0
    expect(c.frameAt(3034)).toEqual({ frame: 1, ended: false });
    expect(c.frameAt(6000)).toEqual({ frame: 0, ended: false });
  });

  it("seek clamps into range and preserves play state", () => {
    const c = clock();
    c.seek(500, 0);
    expect(c.frameAt(0)).toEqual({ frame: 89, ended: false });

    c.seek(-5, 0);
    expect(c.frameAt(0)).toEqual({ frame: 0, ended: false });
    expect(c.playing).toBe(false);

    c.play(1000);
    c.seek(45, 2000);
    expect(c.playing).toBe(true);
    expect(c.frameAt(2500)).toEqual({ frame: 60, ended: false });
  });

  it("replaying from the final frame restarts at 0", () => {
    const c = clock();
    c.seek(89, 0);
    c.play(100);
    expect(c.frameAt(100)).toEqual({ frame: 0, ended: false });
  });

  it("rejects invalid fps and duration", () => {
    expect(() => new FrameClock({ fps: 0, durationInFrames: 10 })).toThrow(/fps/);
    expect(() => new FrameClock({ fps: 30, durationInFrames: 0 })).toThrow(/durationInFrames/);
    expect(() => new FrameClock({ fps: 30, durationInFrames: 1.5 })).toThrow(/durationInFrames/);
  });
});

// A scene with no assets so the player needs no DOM beyond the 2d context.
const testScene = {
  schemaVersion: 0,
  width: 100,
  height: 100,
  fps: 30,
  duration: 10,
  assets: {},
  nodes: [
    {
      id: "bg",
      type: "div",
      style: { width: "100%", height: "100%", backgroundColor: "#101820" },
    },
  ],
};

function fakeContext(): CanvasRenderingContext2D {
  return {
    globalAlpha: 1,
    fillStyle: "",
    save: () => undefined,
    restore: () => undefined,
    clearRect: () => undefined,
    fillRect: () => undefined,
    translate: () => undefined,
  } as unknown as CanvasRenderingContext2D;
}

/** Manual time + scheduler so playback is fully deterministic in tests. */
function fakeDriver() {
  let time = 0;
  const queue = new Map<number, () => void>();
  let nextHandle = 1;

  return {
    now: () => time,
    requestFrame: (callback: () => void) => {
      const handle = nextHandle++;
      queue.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle: number) => void queue.delete(handle),
    /** Advances the clock then fires every queued callback. */
    async step(ms: number) {
      time += ms;
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) {
        callback();
      }
      // Let the async tick (prepare/render) settle.
      await Promise.resolve();
      await Promise.resolve();
    },
    get pending() {
      return queue.size;
    },
  };
}

describe("Player", () => {
  it("renders frame 0 on creation and frames advance with the clock", async () => {
    const driver = fakeDriver();
    const frames: number[] = [];

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    player.on("frame", (frame) => frames.push(frame));

    expect(player.currentFrame).toBe(0);

    player.play();
    await driver.step(34); // ~1 frame at 30fps
    expect(player.currentFrame).toBe(1);
    await driver.step(100); // skips ahead — latest frame wins, no stale queue
    expect(player.currentFrame).toBe(4);
    expect(frames).toEqual([1, 4]);
  });

  it("pauses, seeks, and fires ended at the final frame", async () => {
    const driver = fakeDriver();
    const events: string[] = [];

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });
    player.on("play", () => events.push("play"));
    player.on("pause", () => events.push("pause"));
    player.on("ended", (frame) => events.push(`ended@${frame}`));

    player.play();
    await driver.step(100);
    player.pause();
    expect(player.playing).toBe(false);
    expect(driver.pending).toBe(0); // no leaked animation frame

    await player.seek(7);
    expect(player.currentFrame).toBe(7);

    player.play();
    await driver.step(1000); // way past the end
    expect(player.playing).toBe(false);
    expect(player.currentFrame).toBe(9);
    expect(events).toEqual(["play", "pause", "play", "ended@9"]);
  });

  it("loops instead of ending when loop is set", async () => {
    const driver = fakeDriver();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      loop: true,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });

    player.play();
    await driver.step(334); // frame 10 → wraps to 0
    expect(player.playing).toBe(true);
    expect(player.currentFrame).toBe(0);

    await driver.step(34);
    expect(player.currentFrame).toBe(1);
    player.dispose();
  });

  it("dispose stops the loop and makes the player inert", async () => {
    const driver = fakeDriver();

    const player = await createPlayer({
      context: fakeContext(),
      scene: testScene,
      now: driver.now,
      requestFrame: driver.requestFrame,
      cancelFrame: driver.cancelFrame,
    });

    player.play();
    player.dispose();
    expect(driver.pending).toBe(0);
    expect(() => player.play()).toThrow(/disposed/);
  });
});
