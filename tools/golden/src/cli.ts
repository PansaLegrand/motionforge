import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright";
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

type ProbeResult = {
  label: string;
  x: number;
  y: number;
  rgba: [number, number, number, number];
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

    if (failures.length > 0) {
      throw new Error(`Golden failures:\n${failures.join("\n\n")}`);
    }
  } finally {
    await browser?.close();
    await closeServer(server);
  }
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
    const offset = (probe.y * frame.width + probe.x) * 4;
    const rgba = frame.rgba.slice(offset, offset + 4) as [
      number,
      number,
      number,
      number,
    ];
    const result: ProbeResult = {
      label: probe.label,
      x: probe.x,
      y: probe.y,
      rgba,
    };

    if (probe.minAlpha !== undefined && rgba[3] < probe.minAlpha) {
      failures.push(
        `${fixture.id}: ${result.label} expected alpha >= ${probe.minAlpha}, got ${rgba[3]}`,
      );
    }

    if (
      probe.notRgb &&
      rgba[0] === probe.notRgb[0] &&
      rgba[1] === probe.notRgb[1] &&
      rgba[2] === probe.notRgb[2]
    ) {
      failures.push(
        `${fixture.id}: ${result.label} expected pixel to differ from rgb(${probe.notRgb.join(", ")}), got ${rgba.join(", ")}`,
      );
    }
  }

  return failures;
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
