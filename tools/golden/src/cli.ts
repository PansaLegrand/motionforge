import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { fixtures, type GoldenFixture } from "./fixtures.js";

type GoldenMode = "test" | "update";

type RenderedFrame = {
  width: number;
  height: number;
  rgba: number[];
};

type GoldenSnapshot = {
  fixtureId: string;
  frame: number;
  width: number;
  height: number;
  hash: string;
};

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const goldenDir = resolve(rootDir, "fixtures/goldens");
const harnessDir = resolve(rootDir, "tools/golden");
const mode = parseMode(process.argv[2]);

await run(mode);

async function run(currentMode: GoldenMode): Promise<void> {
  const server = await createServer({
    root: harnessDir,
    logLevel: "error",
    // Resolve workspace packages from source so goldens never depend on a
    // stale or missing dist build.
    resolve: {
      alias: {
        "@motionforge/schema": resolve(rootDir, "packages/schema/src/index.ts"),
        "@motionforge/core": resolve(rootDir, "packages/core/src/index.ts"),
        "@motionforge/renderer-canvas2d": resolve(
          rootDir,
          "packages/renderer-canvas2d/src/index.ts",
        ),
        "@motionforge/export": resolve(rootDir, "packages/export/src/index.ts"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 0,
      strictPort: false,
    },
  });

  let browser: Browser | undefined;

  try {
    await server.listen();
    const url = server.resolvedUrls?.local[0];

    if (!url) {
      throw new Error("Golden harness dev server did not expose a local URL.");
    }

    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "load" });

    const failures: string[] = [];

    for (const fixture of fixtures) {
      const rendered = await page.evaluate(
        ({ scene, frame }) => window.renderGoldenFrame(scene, frame),
        { scene: fixture.scene, frame: fixture.frame },
      );

      if (fixture.kind === "exact") {
        const snapshot = snapshotFrame(fixture, rendered);
        const snapshotPath = resolve(goldenDir, `${fixture.id}.json`);

        if (currentMode === "update") {
          await writeSnapshot(snapshotPath, snapshot);
          console.log(`updated ${fixture.id} ${snapshot.hash}`);
        } else {
          const expected = await readSnapshot(snapshotPath);

          if (expected.hash !== snapshot.hash) {
            failures.push(
              [
                `${fixture.id}: hash mismatch`,
                `  expected ${expected.hash}`,
                `  received ${snapshot.hash}`,
                `  run pnpm golden:update after inspecting the visual change`,
              ].join("\n"),
            );
          } else {
            console.log(`ok ${fixture.id} ${snapshot.hash}`);
          }
        }
      } else {
        const probeFailures = evaluateProbes(fixture, rendered);

        if (probeFailures.length > 0) {
          failures.push(...probeFailures);
        } else {
          console.log(`ok ${fixture.id} probes`);
        }
      }
    }

    failures.push(...(await runExportSmokeTest(page)));
    failures.push(...(await runVideoChecks(page)));

    if (failures.length > 0) {
      throw new Error(`Golden failures:\n${failures.join("\n\n")}`);
    }
  } finally {
    await browser?.close();
    await closeServer(server);
  }
}

/**
 * Encodes a short scene to MP4 inside the harness browser and checks the
 * result is a plausible MP4 file. This is the integration test for
 * exportVideo(); Node cannot run it because it has no WebCodecs.
 */
async function runExportSmokeTest(page: Page): Promise<string[]> {
  const fixture = fixtures.find((entry) => entry.id === "opacity-keyframe");

  if (!fixture) {
    return ["export-smoke: missing opacity-keyframe fixture scene"];
  }

  const exported = await page.evaluate(
    (scene) => window.renderGoldenExport(scene),
    fixture.scene,
  );

  const failures: string[] = [];
  const ftyp = String.fromCharCode(...exported.header.slice(4, 8));

  if (exported.size <= 0) {
    failures.push("export-smoke: produced an empty file");
  }

  if (ftyp !== "ftyp") {
    failures.push(
      `export-smoke: expected an MP4 ftyp box at byte 4, got "${ftyp}" (header ${exported.header.join(",")})`,
    );
  }

  if (exported.totalFrames !== fixture.scene.duration) {
    failures.push(
      `export-smoke: expected ${fixture.scene.duration} frames, got ${exported.totalFrames}`,
    );
  }

  if (failures.length === 0) {
    console.log(
      `ok export-smoke ${exported.size} bytes, ${exported.codec}, ${exported.totalFrames} frames, ${exported.mimeType}`,
    );
  }

  return failures;
}

/**
 * Video clip integration checks: synthesize a clip with exportVideo, composite
 * it through video nodes (trim + playbackRate), verify preview pixels, then
 * export the composite and verify the decoded file matches the preview.
 */
async function runVideoChecks(page: Page): Promise<string[]> {
  const checks = await page.evaluate(() => window.runGoldenVideoChecks());
  const failures: string[] = [];

  for (const check of checks) {
    if (check.pass) {
      console.log(`ok video: ${check.label} (${check.detail})`);
    } else {
      failures.push(`video: ${check.label} failed — ${check.detail}`);
    }
  }

  return failures;
}

async function launchBrowser(): Promise<Browser> {
  // Default to the Playwright-pinned Chromium so every machine hashes pixels
  // from the same browser build. GOLDEN_CHROME_PATH overrides for debugging.
  return chromium.launch({
    executablePath: process.env.GOLDEN_CHROME_PATH,
    headless: true,
  });
}

function snapshotFrame(
  fixture: GoldenFixture,
  frame: RenderedFrame,
): GoldenSnapshot {
  return {
    fixtureId: fixture.id,
    frame: fixture.frame,
    width: frame.width,
    height: frame.height,
    hash: hashFrame(frame),
  };
}

function hashFrame(frame: RenderedFrame): string {
  return createHash("sha256").update(Buffer.from(frame.rgba)).digest("hex");
}

async function readSnapshot(path: string): Promise<GoldenSnapshot> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as GoldenSnapshot;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `Missing golden snapshot ${path}. Run pnpm golden:update to create it.`,
      );
    }

    throw error;
  }
}

async function writeSnapshot(
  path: string,
  snapshot: GoldenSnapshot,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function evaluateProbes(
  fixture: Extract<GoldenFixture, { kind: "probe" }>,
  frame: RenderedFrame,
): string[] {
  const failures: string[] = [];

  for (const probe of fixture.probes) {
    // A probe with toX scans the row segment [x, toX] and passes if any pixel
    // matches; a point probe checks the single pixel at (x, y).
    const xs = probe.toX === undefined ? [probe.x] : range(probe.x, probe.toX);
    const pixels = xs.map((x) => readPixel(frame, x, probe.y));
    const anyMatch = pixels.some((rgba) => probeMatches(probe, rgba));

    if (!anyMatch) {
      const sample = pixels[Math.floor(pixels.length / 2)] ?? [0, 0, 0, 0];
      const where =
        probe.toX === undefined
          ? `at (${probe.x}, ${probe.y})`
          : `in row ${probe.y}, x ${probe.x}..${probe.toX}`;
      failures.push(
        `${fixture.id}: ${probe.label} found no matching pixel ${where} ` +
          `(minAlpha=${probe.minAlpha ?? "-"}, notRgb=${probe.notRgb?.join(",") ?? "-"}, sample=${sample.join(",")})`,
      );
    }
  }

  return failures;
}

function probeMatches(
  probe: { minAlpha?: number; notRgb?: [number, number, number] },
  rgba: [number, number, number, number],
): boolean {
  if (probe.minAlpha !== undefined && rgba[3] < probe.minAlpha) {
    return false;
  }

  if (
    probe.notRgb &&
    rgba[0] === probe.notRgb[0] &&
    rgba[1] === probe.notRgb[1] &&
    rgba[2] === probe.notRgb[2]
  ) {
    return false;
  }

  return true;
}

function readPixel(
  frame: RenderedFrame,
  x: number,
  y: number,
): [number, number, number, number] {
  const offset = (y * frame.width + x) * 4;
  return frame.rgba.slice(offset, offset + 4) as [
    number,
    number,
    number,
    number,
  ];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

function parseMode(value: string | undefined): GoldenMode {
  if (value === "test" || value === "update") {
    return value;
  }

  throw new Error("Usage: tsx src/cli.ts <test|update>");
}

async function closeServer(server: ViteDevServer): Promise<void> {
  await server.close();
}
