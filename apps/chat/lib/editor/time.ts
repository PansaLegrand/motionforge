export function formatSeconds(frames: number, fps: number): string {
  return `${(frames / fps).toFixed(2)}s`;
}

export function formatFrameTime(frame: number, fps: number): string {
  const safeFps = Math.max(1, fps);
  const totalSeconds = Math.max(0, Math.floor(frame / safeFps));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
