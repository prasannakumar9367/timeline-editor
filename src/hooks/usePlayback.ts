import { useEffect, useRef, useCallback, useState } from 'react';
import { useEditorStore } from '../store/editorStore';

const FPS_SAMPLES = 30;

/**
 * Drives the master clock via requestAnimationFrame while `isPlaying` is true.
 * Returns the current FPS for the HUD.
 */
export function usePlayback() {
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const duration = useEditorStore((s) => s.duration);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const pause = useEditorStore((s) => s.pause);
  const [fps, setFps] = useState(0);

  const lastFrameRef = useRef(performance.now());
  const fpsBuffer = useRef<number[]>([]);
  const rafId = useRef(0);

  const tick = useCallback(() => {
    const now = performance.now();
    const delta = (now - lastFrameRef.current) / 1000; // seconds
    lastFrameRef.current = now;

    // FPS bookkeeping
    if (delta > 0) {
      fpsBuffer.current.push(1 / delta);
      if (fpsBuffer.current.length > FPS_SAMPLES) fpsBuffer.current.shift();
      const avg = fpsBuffer.current.reduce((a, b) => a + b, 0) / fpsBuffer.current.length;
      setFps(Math.round(avg));
    }

    // Advance time and stop cleanly at the end of the last active clip
    const { currentTime, clips, tracks } = useEditorStore.getState();
    const mutedTrackIds = new Set(tracks.filter((t) => t.muted).map((t) => t.id));
    const activeClips = clips.filter((c) => !mutedTrackIds.has(c.trackId));
    const contentEnd =
      activeClips.length > 0
        ? Math.max(...activeClips.map((c) => c.startTime + c.duration))
        : duration;

    const next = currentTime + delta;
    if (next >= contentEnd) {
      setCurrentTime(contentEnd);
      pause();
      return;
    } else {
      setCurrentTime(next);
    }

    rafId.current = requestAnimationFrame(tick);
  }, [duration, setCurrentTime, pause]);

  useEffect(() => {
    if (isPlaying) {
      lastFrameRef.current = performance.now();
      rafId.current = requestAnimationFrame(tick);
    }
    return () => cancelAnimationFrame(rafId.current);
  }, [isPlaying, tick]);

  return fps;
}
