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

export function frameFromTimelinePoint({
  clientX,
  timelineLeft,
  timelineWidth,
  duration,
}: {
  clientX: number;
  timelineLeft: number;
  timelineWidth: number;
  duration: number;
}): number {
  const maxFrame = Math.max(0, duration - 1);

  if (maxFrame === 0 || timelineWidth <= 0) {
    return 0;
  }

  const progress = (clientX - timelineLeft) / timelineWidth;
  const clamped = Math.min(1, Math.max(0, progress));

  return Math.round(clamped * maxFrame);
}
