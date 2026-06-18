import { detectExportCapability, exportVideo } from "@motionforge/export";
import { createPlayer, type Player } from "@motionforge/player";
import { applyScenePatch, validateScene } from "@motionforge/schema";
import {
  disposeAssets,
  resolveAssets,
  type ResolvedAssets,
} from "@motionforge/renderer-canvas2d";
import {
  findPresetGalleryScene,
  showcaseScenes,
  type ShowcaseScene,
} from "@motionforge/showcase";
import {
  buildPresetPatchExample,
  presetCatalog,
  presetFamilyLabels,
  type PresetPatchExample,
  type PresetCatalogItem,
  type PresetFamily,
} from "./preset-catalog.js";
import "./styles.css";

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Playground DOM is missing ${selector}.`);
  }

  return element;
}

const canvas = requiredElement<HTMLCanvasElement>("#preview");
const sceneSelect = requiredElement<HTMLSelectElement>("#scene");
const sceneTitle = requiredElement<HTMLHeadingElement>("#scene-title");
const sceneDescription =
  requiredElement<HTMLParagraphElement>("#scene-description");
const sceneProves = requiredElement<HTMLUListElement>("#scene-proves");
const presetFamilyTabs = requiredElement<HTMLDivElement>("#preset-family-tabs");
const presetList = requiredElement<HTMLDivElement>("#preset-list");
const presetSnippetTitle = requiredElement<HTMLElement>(
  "#preset-snippet-title",
);
const presetSnippet = requiredElement<HTMLPreElement>("#preset-snippet");
const presetPreview = requiredElement<HTMLButtonElement>("#preset-preview");
const presetCopy = requiredElement<HTMLButtonElement>("#preset-copy");
const presetCopyStatus = requiredElement<HTMLOutputElement>(
  "#preset-copy-status",
);
const presetPatchTitle = requiredElement<HTMLElement>("#preset-patch-title");
const presetPatchDescription = requiredElement<HTMLParagraphElement>(
  "#preset-patch-description",
);
const presetPatch = requiredElement<HTMLPreElement>("#preset-patch");
const presetPatchApply = requiredElement<HTMLButtonElement>(
  "#preset-patch-apply",
);
const presetPatchCopy = requiredElement<HTMLButtonElement>(
  "#preset-patch-copy",
);
const presetPatchStatus = requiredElement<HTMLOutputElement>(
  "#preset-patch-status",
);
const slider = requiredElement<HTMLInputElement>("#frame");
const readout = requiredElement<HTMLOutputElement>("#frame-readout");
const playButton = requiredElement<HTMLButtonElement>("#play");
const exportButton = requiredElement<HTMLButtonElement>("#export");
const exportStatus = requiredElement<HTMLOutputElement>("#export-status");
const capability = requiredElement<HTMLPreElement>("#capability");
const agentInput = requiredElement<HTMLTextAreaElement>("#agent-input");
const agentApply = requiredElement<HTMLButtonElement>("#agent-apply");
const agentLoad = requiredElement<HTMLButtonElement>("#agent-load");
const agentCopy = requiredElement<HTMLButtonElement>("#agent-copy");
const agentOutput = requiredElement<HTMLPreElement>("#agent-output");

const context = canvas.getContext("2d");

if (!context) {
  throw new Error("Canvas2D is unavailable.");
}

const renderContext = context;
const capabilityResult = detectExportCapability();

let current = showcaseScenes[0] as ShowcaseScene;
// The document on screen. Starts as a showcase scene; the agent console can
// patch it or replace it entirely.
let currentDoc: unknown = current.scene;
let assets: ResolvedAssets | undefined;
let player: Player | undefined;
let loadVersion = 0;
let selectedPresetFamily: PresetFamily = "subtitles";
let selectedPreset = presetCatalog[0] as PresetCatalogItem;
let selectedPatchExample: PresetPatchExample | undefined;

capability.textContent = JSON.stringify(capabilityResult, null, 2);

for (const entry of showcaseScenes) {
  const option = document.createElement("option");
  option.value = entry.id;
  option.textContent = entry.title;
  sceneSelect.append(option);
}

renderPresetExplorer();

function showFrame(frame: number): void {
  slider.value = String(frame);
  readout.value = String(frame);
}

slider.addEventListener("input", () => {
  if (!player) {
    return;
  }

  player.pause();
  playButton.textContent = "Play";
  void player.seek(Number(slider.value));
});

playButton.addEventListener("click", () => {
  if (!player) {
    return;
  }

  if (player.playing) {
    player.pause();
    playButton.textContent = "Play";
  } else {
    player.play();
    playButton.textContent = "Pause";
  }
});

sceneSelect.addEventListener("change", () => {
  const next = showcaseScenes.find((entry) => entry.id === sceneSelect.value);

  if (next) {
    void loadScene(next);
  }
});

if (!capabilityResult.videoEncoder) {
  exportButton.disabled = true;
  exportStatus.value = "WebCodecs is unavailable in this browser.";
}

exportButton.addEventListener("click", () => {
  void runExport();
});

async function runExport(): Promise<void> {
  exportButton.disabled = true;

  try {
    const { blob, codec, totalFrames } = await exportVideo({
      scene: currentDoc as Parameters<typeof exportVideo>[0]["scene"],
      assets,
      onProgress: ({ frameIndex, totalFrames: total }) => {
        exportStatus.value = `Encoding frame ${frameIndex + 1}/${total}`;
      },
    });

    downloadBlob(blob, `motionforge-${current.id}.mp4`);
    exportStatus.value = `Done: ${(blob.size / 1024).toFixed(0)} KiB, ${codec}, ${totalFrames} frames`;
  } catch (error) {
    exportStatus.value = error instanceof Error ? error.message : String(error);
  } finally {
    exportButton.disabled = !capabilityResult.videoEncoder;
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function loadScene(entry: ShowcaseScene): Promise<void> {
  current = entry;
  currentDoc = entry.scene;
  sceneSelect.value = entry.id;
  sceneTitle.textContent = entry.title;
  sceneDescription.textContent = entry.description;
  sceneProves.replaceChildren(
    ...entry.proves.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );
  renderPresetSnippet();

  await loadSceneDoc(entry.scene, entry.posterFrame);
}

/** Loads any validated scene document into the canvas/player lifecycle. */
async function loadSceneDoc(
  sceneDoc: ShowcaseScene["scene"],
  posterFrame?: number,
): Promise<void> {
  const version = ++loadVersion;
  player?.dispose();
  player = undefined;
  playButton.textContent = "Play";

  canvas.width = sceneDoc.width;
  canvas.height = sceneDoc.height;
  slider.max = String(sceneDoc.duration - 1);
  const landingFrame = Math.min(
    posterFrame ?? Number(slider.value),
    sceneDoc.duration - 1,
  );
  showFrame(landingFrame);
  exportButton.disabled = true;
  exportStatus.value = "Loading scene assets...";

  const previousAssets = assets;
  assets = undefined;
  renderContext.clearRect(0, 0, canvas.width, canvas.height);

  try {
    const resolved = await resolveAssets(sceneDoc);

    if (version !== loadVersion) {
      disposeAssets(resolved);
      return;
    }

    previousAssets && disposeAssets(previousAssets);
    assets = resolved;

    // The playground owns the assets (export reuses them), so the player
    // gets them pre-resolved and never disposes them itself.
    const created = await createPlayer({
      context: renderContext,
      scene: sceneDoc,
      assets,
      loop: true,
    });

    if (version !== loadVersion) {
      created.dispose();
      return;
    }

    player = created;
    player.on("frame", showFrame);
    // Land on the poster frame; the user may also have scrubbed during load.
    await player.seek(Number(slider.value));
    exportButton.disabled = !capabilityResult.videoEncoder;
    exportStatus.value = "";
  } catch (error) {
    if (version === loadVersion) {
      exportStatus.value =
        error instanceof Error ? error.message : String(error);
    }
  }
}

// ---------------------------------------------------------------------------
// Agent console: the chat loop minus the LLM. Paste what an agent would emit
// (a patch op list or a whole scene), apply it through the same public APIs
// an agent uses, and read the same errors an agent would read.

function agentReport(lines: string[], isError: boolean): void {
  agentOutput.textContent = lines.join("\n");
  agentOutput.classList.toggle("agent-error", isError);
}

function parseAgentJson(): unknown | undefined {
  try {
    return JSON.parse(agentInput.value);
  } catch (error) {
    agentReport(
      [`Not valid JSON: ${error instanceof Error ? error.message : error}`],
      true,
    );
    return undefined;
  }
}

agentApply.addEventListener("click", () => {
  const patch = parseAgentJson();

  if (patch === undefined) {
    return;
  }

  const result = applyScenePatch(currentDoc, patch);

  if (!result.ok) {
    // Messages already carry their op index / path.
    agentReport(
      result.errors.map((e) => e.message),
      true,
    );
    return;
  }

  currentDoc = result.scene;
  const ops = Array.isArray(patch) ? patch.length : 0;
  agentReport([`✓ patch applied (${ops} op${ops === 1 ? "" : "s"})`], false);
  renderPresetSnippet();
  void loadSceneDoc(result.scene);
});

agentLoad.addEventListener("click", () => {
  const doc = parseAgentJson();

  if (doc === undefined) {
    return;
  }

  const result = validateScene(doc);

  if (!result.ok) {
    agentReport(result.errors, true);
    return;
  }

  currentDoc = result.scene;
  sceneTitle.textContent = "Custom scene";
  sceneDescription.textContent = "Loaded from the agent console.";
  sceneProves.replaceChildren();
  agentReport(["✓ scene is valid — loaded"], false);
  renderPresetSnippet();
  void loadSceneDoc(result.scene, 0);
});

agentCopy.addEventListener("click", () => {
  const json = JSON.stringify(currentDoc, null, 2);
  void navigator.clipboard
    .writeText(json)
    .then(() => agentReport(["✓ scene JSON copied to clipboard"], false))
    .catch(() => {
      agentInput.value = json;
      agentReport(
        ["Clipboard unavailable — scene JSON placed in the box."],
        true,
      );
    });
});

function renderPresetExplorer(): void {
  renderPresetFamilyTabs();
  renderPresetList();
  renderPresetSnippet();
}

function renderPresetFamilyTabs(): void {
  const familyEntries = Object.entries(presetFamilyLabels) as Array<
    [PresetFamily, string]
  >;

  presetFamilyTabs.replaceChildren(
    ...familyEntries.map(([family, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-family-tab";
      button.textContent = label;
      button.dataset.active =
        selectedPresetFamily === family ? "true" : "false";
      button.addEventListener("click", () => {
        selectedPresetFamily = family as PresetFamily;
        selectedPreset =
          presetCatalog.find((item) => item.family === selectedPresetFamily) ??
          selectedPreset;
        renderPresetExplorer();
      });
      return button;
    }),
  );
}

function renderPresetList(): void {
  const items = presetCatalog.filter(
    (item) => item.family === selectedPresetFamily,
  );

  presetList.replaceChildren(
    ...items.map((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-card";
      button.dataset.active =
        item.key === selectedPreset.key ? "true" : "false";
      button.addEventListener("click", () => {
        selectedPreset = item;
        renderPresetList();
        renderPresetSnippet();
      });

      const heading = document.createElement("span");
      heading.className = "preset-card-heading";
      heading.textContent = item.name;

      const meta = document.createElement("span");
      meta.className = "preset-card-meta";
      meta.textContent = `${item.key} · ${item.category}`;

      const description = document.createElement("span");
      description.className = "preset-card-description";
      description.textContent = item.description;

      button.append(heading, meta, description);
      return button;
    }),
  );
}

function renderPresetSnippet(): void {
  presetSnippetTitle.textContent = `${selectedPreset.name} snippet`;
  presetSnippet.textContent = selectedPreset.snippet;
  presetCopyStatus.value = "";
  presetPreview.disabled =
    findPresetGalleryScene(selectedPresetFamily) === undefined;
  renderPresetPatchExample();
}

function renderPresetPatchExample(): void {
  selectedPatchExample = buildPresetPatchExample(selectedPreset, currentDoc);
  presetPatchStatus.value = "";
  presetPatchTitle.textContent = selectedPatchExample.title;

  if (selectedPatchExample.ok) {
    presetPatchDescription.textContent = selectedPatchExample.description;
    presetPatch.textContent = JSON.stringify(selectedPatchExample.patch, null, 2);
    presetPatch.dataset.available = "true";
    presetPatchApply.disabled = false;
    presetPatchCopy.disabled = false;
    return;
  }

  presetPatchDescription.textContent = selectedPatchExample.reason;
  presetPatch.textContent = "";
  presetPatch.dataset.available = "false";
  presetPatchApply.disabled = true;
  presetPatchCopy.disabled = true;
}

presetPreview.addEventListener("click", () => {
  const gallery = findPresetGalleryScene(selectedPresetFamily);

  if (!gallery) {
    presetCopyStatus.value =
      "No gallery scene available for this preset family.";
    return;
  }

  currentDoc = gallery.scene;
  current = {
    id: gallery.id,
    title: gallery.title,
    description: gallery.description,
    proves: gallery.proves,
    scene: gallery.scene,
    posterFrame: gallery.posterFrame,
  };
  sceneTitle.textContent = gallery.title;
  sceneDescription.textContent = gallery.description;
  sceneProves.replaceChildren(
    ...gallery.proves.map((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      return li;
    }),
  );
  renderPresetSnippet();
  presetCopyStatus.value = `Previewing ${presetFamilyLabels[selectedPresetFamily]}`;
  void loadSceneDoc(gallery.scene, gallery.posterFrame);
});

presetCopy.addEventListener("click", () => {
  void navigator.clipboard
    .writeText(selectedPreset.snippet)
    .then(() => {
      presetCopyStatus.value = `Copied ${selectedPreset.key}`;
    })
    .catch(() => {
      agentInput.value = selectedPreset.snippet;
      presetCopyStatus.value =
        "Clipboard unavailable; snippet placed in the agent box.";
    });
});

presetPatchCopy.addEventListener("click", () => {
  if (!selectedPatchExample?.ok) {
    return;
  }

  const json = JSON.stringify(selectedPatchExample.patch, null, 2);

  void navigator.clipboard
    .writeText(json)
    .then(() => {
      presetPatchStatus.value = `Copied ${selectedPreset.key} patch`;
    })
    .catch(() => {
      agentInput.value = json;
      presetPatchStatus.value =
        "Clipboard unavailable; patch placed in the agent box.";
    });
});

presetPatchApply.addEventListener("click", () => {
  if (!selectedPatchExample?.ok) {
    return;
  }

  const result = applyScenePatch(currentDoc, selectedPatchExample.patch);

  if (!result.ok) {
    presetPatchStatus.value = result.errors.map((error) => error.message).join("\n");
    return;
  }

  currentDoc = result.scene;
  agentReport(
    [`✓ preset patch applied (${selectedPatchExample.patch.length} op)`],
    false,
  );
  renderPresetSnippet();
  presetPatchStatus.value = `Applied ${selectedPreset.key}`;
  void loadSceneDoc(result.scene);
});

void loadScene(current);
