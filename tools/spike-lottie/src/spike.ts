// THROWAWAY SPIKE — can lottie-web render frame-exact, deterministic pixels
// into a canvas we control, the way motionforge stages video frames?
// Deliverable: docs/lottie-spike.md. Run: pnpm --filter @motionforge/spike-lottie run spike

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = dirname(fileURLToPath(import.meta.url));
const lottieJs = readFileSync(
  resolve(here, "../node_modules/lottie-web/build/player/lottie.min.js"),
  "utf8",
);

// Minimal hand-written Lottie document (v5 schema): 60 frames @ 30fps,
// 200x200, one shape layer — a teal rectangle translating left→right with a
// rotating star-ish polygon. No external assets, no expressions.
const animationData = {
  v: "5.7.4",
  fr: 30,
  ip: 0,
  op: 60,
  w: 200,
  h: 200,
  nm: "spike",
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: "rect",
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: {
          a: 1,
          k: [
            { t: 0, s: [0], e: [180], i: { x: [0.5], y: [0.5] }, o: { x: [0.5], y: [0.5] } },
            { t: 60, s: [180] },
          ],
        },
        p: {
          a: 1,
          k: [
            { t: 0, s: [40, 100, 0], e: [160, 100, 0], i: { x: 0.5, y: 0.5 }, o: { x: 0.5, y: 0.5 } },
            { t: 60, s: [160, 100, 0] },
          ],
        },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      shapes: [
        {
          ty: "gr",
          nm: "group",
          it: [
            { ty: "rc", nm: "box", d: 1, s: { a: 0, k: [60, 60] }, p: { a: 0, k: [0, 0] }, r: { a: 0, k: 8 } },
            { ty: "fl", nm: "fill", c: { a: 0, k: [0.4, 0.96, 0.84, 1] }, o: { a: 0, k: 100 } },
            { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
          ],
        },
      ],
      ip: 0,
      op: 60,
      st: 0,
    },
  ],
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent("<canvas id='c' width='200' height='200'></canvas>");
await page.addScriptTag({ content: lottieJs });

// Browser-side code passed as a string: tsx/esbuild injects a __name helper
// into transformed closures that does not survive Playwright serialization.
const browserCode = `(async () => {
  const data = ${JSON.stringify(animationData)};
  const canvas = document.getElementById("c");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  // The pattern a motionforge integration would use: lottie renders into a
  // context WE own, autoplay off, frame-seek only.
  const animation = window.lottie.loadAnimation({
    renderer: "canvas",
    loop: false,
    autoplay: false,
    animationData: data,
    rendererSettings: { context, clearCanvas: true },
  });

  await new Promise((r) => animation.addEventListener("DOMLoaded", r));

  const hashFrame = (frame) => {
    animation.goToAndStop(frame, true); // true = frame mode, not ms
    const pixels = context.getImageData(0, 0, 200, 200).data;
    let h = 0;
    for (let i = 0; i < pixels.length; i += 1) {
      h = (h * 31 + (pixels[i] ?? 0)) >>> 0;
    }
    return h.toString(16);
  };

  const t0 = performance.now();
  const f10a = hashFrame(10);
  const f40 = hashFrame(40);
  const f10b = hashFrame(10); // seek BACKWARDS, then re-render
  const f10c = hashFrame(10);
  const elapsed = performance.now() - t0;

  // out-of-range behavior
  const f999 = hashFrame(999);
  const fLast = hashFrame(59);

  const png = canvas.toDataURL("image/png");
  return { f10a, f40, f10b, f10c, f999, fLast, msFor6Seeks: elapsed, png };
})()`;

const results = (await page.evaluate(browserCode)) as {
  f10a: string;
  f40: string;
  f10b: string;
  f10c: string;
  f999: string;
  fLast: string;
  msFor6Seeks: number;
  png: string;
};

console.log("frame 10 first render:   ", results.f10a);
console.log("frame 40:                ", results.f40);
console.log("frame 10 after backseek: ", results.f10b);
console.log("frame 10 again:          ", results.f10c);
console.log("deterministic:", results.f10a === results.f10b && results.f10b === results.f10c);
console.log("distinct frames differ:", results.f10a !== results.f40);
console.log("frame 999 == last frame:", results.f999 === results.fLast, "(clamp behavior)");
console.log("6 seeks took", results.msFor6Seeks.toFixed(1), "ms");

const hash = createHash("sha256").update(results.png).digest("hex").slice(0, 12);
console.log("final canvas png sha (run twice to compare):", hash);

await browser.close();
