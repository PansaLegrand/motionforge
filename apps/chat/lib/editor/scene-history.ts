import type { Scene } from "@motionforge/schema";

export type SceneHistory = {
  past: Scene[];
  future: Scene[];
};

export const sceneHistoryLimit = 50;

export function createSceneHistory(): SceneHistory {
  return { past: [], future: [] };
}

export function recordSceneHistory(
  history: SceneHistory,
  currentScene: Scene | null,
  limit = sceneHistoryLimit,
): SceneHistory {
  if (!currentScene) {
    return createSceneHistory();
  }

  return {
    past: [...history.past, currentScene].slice(-limit),
    future: [],
  };
}

export function undoSceneHistory(
  currentScene: Scene | null,
  history: SceneHistory,
): { changed: true; scene: Scene; history: SceneHistory } | { changed: false } {
  if (!currentScene || !history.past.length) {
    return { changed: false };
  }

  const scene = history.past[history.past.length - 1];

  if (!scene) {
    return { changed: false };
  }

  return {
    changed: true,
    scene,
    history: {
      past: history.past.slice(0, -1),
      future: [currentScene, ...history.future],
    },
  };
}

export function redoSceneHistory(
  currentScene: Scene | null,
  history: SceneHistory,
): { changed: true; scene: Scene; history: SceneHistory } | { changed: false } {
  if (!currentScene || !history.future.length) {
    return { changed: false };
  }

  const scene = history.future[0];

  if (!scene) {
    return { changed: false };
  }

  return {
    changed: true,
    scene,
    history: {
      past: [...history.past, currentScene],
      future: history.future.slice(1),
    },
  };
}
