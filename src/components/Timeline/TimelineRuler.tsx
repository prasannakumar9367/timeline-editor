import React, { useRef, useMemo } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { formatTime } from '../../utils/time';

interface TimelineRulerProps {
  totalWidth: number;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ totalWidth }) => {
  const duration = useEditorStore((s) => s.duration);
  const pixelsPerSecond = useEditorStore((s) => s.pixelsPerSecond);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);

  const rulerRef = useRef<HTMLDivElement>(null);

  // Compute tick interval based on zoom (pixelsPerSecond)
  const { majorInterval, minorInterval } = useMemo(() => {
    if (pixelsPerSecond < 30) {
      return { majorInterval: 10, minorInterval: 2 };
    } else if (pixelsPerSecond < 60) {
      return { majorInterval: 5, minorInterval: 1 };
    } else if (pixelsPerSecond < 140) {
      return { majorInterval: 2, minorInterval: 0.5 };
    } else {
      return { majorInterval: 1, minorInterval: 0.25 };
    }
  }, [pixelsPerSecond]);

  // Generate tick markers
  const ticks = useMemo(() => {
    const list: Array<{ time: number; isMajor: boolean; label?: string }> = [];
    const totalTicks = Math.ceil(duration / minorInterval);

    for (let i = 0; i <= totalTicks; i++) {
      const time = i * minorInterval;
      if (time > duration) break;
      const isMajor = Math.abs(time % majorInterval) < 0.001;
      list.push({
        time,
        isMajor,
        label: isMajor ? formatTime(time) : undefined,
      });
    }
    return list;
  }, [duration, majorInterval, minorInterval]);

  // Scrubbing handler
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !rulerRef.current) return;
    const rect = rulerRef.current.getBoundingClientRect();

    const updateTimeFromEvent = (clientX: number) => {
      const offsetX = Math.max(0, clientX - rect.left);
      const newTime = Math.min(duration, offsetX / pixelsPerSecond);
      setCurrentTime(newTime);
    };

    updateTimeFromEvent(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updateTimeFromEvent(ev.clientX);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      ref={rulerRef}
      className="timeline-ruler"
      style={{ width: `${totalWidth}px` }}
      onPointerDown={handlePointerDown}
    >
      {ticks.map((t, idx) => {
        const leftPx = t.time * pixelsPerSecond;
        return (
          <div
            key={idx}
            className={`timeline-ruler-tick ${
              t.isMajor ? 'timeline-ruler-tick-major' : 'timeline-ruler-tick-minor'
            }`}
            style={{ left: `${leftPx}px` }}
          >
            {t.isMajor && t.label && (
              <span className="timeline-ruler-label">{t.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
