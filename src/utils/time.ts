/** Format seconds → "MM:SS.f" */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const frac = Math.floor((secs - whole) * 10);
  return `${String(mins).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${frac}`;
}

/** Format seconds for timeline transport → "0:00.00" */
export function formatPreciseTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const whole = Math.floor(secs);
  const hundredths = Math.floor((secs - whole) * 100);
  return `${mins}:${String(whole).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

/** Format seconds for timeline ruler ticks → "0:00", "0:02", "0:04" */
export function formatRulerTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Snap a value to the nearest grid line. */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
