import React, { useEffect, useMemo, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type {
  Track,
  TimelineClip as ClipType,
  LibraryDragData,
  TransitionType,
} from '../../types/editor';
import { TimelineClip } from './TimelineClip';
import { TransitionIcon } from '../Icons/Icons';

interface TimelineTrackProps {
  track: Track;
  clips: ClipType[];
  totalWidth: number;
}

const TRANSITION_OPTIONS: Array<{ type: TransitionType; label: string }> = [
  { type: 'fade', label: 'Fade' },
  { type: 'slide-left', label: 'Slide Left' },
  { type: 'slide-right', label: 'Slide Right' },
  { type: 'zoom', label: 'Zoom' },
  { type: 'wipe', label: 'Wipe' },
];

const TRANSITION_DURATIONS = [0.3, 0.5, 0.8, 1.0] as const;

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  clips,
  totalWidth,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [openTransitionClipId, setOpenTransitionClipId] = useState<string | null>(null);
  const pixelsPerSecond = useEditorStore((s) => s.pixelsPerSecond);
  const addClip = useEditorStore((s) => s.addClip);
  const updateClip = useEditorStore((s) => s.updateClip);

  // Close transition popover when clicking anywhere outside
  useEffect(() => {
    if (!openTransitionClipId) return;
    const handleOutsideClick = () => setOpenTransitionClipId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openTransitionClipId]);

  // Detect seams between adjacent visual clips on this track for transition buttons
  const transitionSeams = useMemo(() => {
    const visual = clips
      .filter((c) => c.mediaType === 'video' || c.mediaType === 'image')
      .sort((a, b) => a.startTime - b.startTime);

    const seams: Array<{ clip: ClipType; seamTime: number }> = [];
    for (let i = 1; i < visual.length; i++) {
      const prev = visual[i - 1];
      const curr = visual[i];
      const prevEnd = prev.startTime + prev.duration;
      if (Math.abs(curr.startTime - prevEnd) <= 0.35) {
        seams.push({ clip: curr, seamTime: (prevEnd + curr.startTime) / 2 });
      }
    }
    return seams;
  }, [clips]);

  const handleDragOver = (e: React.DragEvent) => {
    if (track.locked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only deactivate if leaving the track element itself
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (track.locked) return;
    e.preventDefault();
    setIsDragOver(false);

    try {
      const rawData =
        e.dataTransfer.getData('application/json') ||
        e.dataTransfer.getData('text/plain');
      if (!rawData) return;
      const data: LibraryDragData = JSON.parse(rawData);
      if (!data.mediaId) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const dropOffsetX = Math.max(0, e.clientX - rect.left);
      const dropTime = Math.max(0, dropOffsetX / pixelsPerSecond);

      addClip(data.mediaId, track.id, dropTime);
    } catch (err) {
      console.error('Error handling track drop:', err);
    }
  };

  return (
    <div
      className={`timeline-track-lane ${isDragOver ? 'timeline-track-dragover' : ''} ${
        track.locked ? 'timeline-track-locked' : ''
      }`}
      style={{ width: `${totalWidth}px` }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Grid lines for this track */}
      <div className="timeline-track-grid" />

      {/* Render clips on this track */}
      {clips.map((clip) => (
        <TimelineClip key={clip.id} clip={clip} />
      ))}

      {/* Transition buttons between adjacent clips */}
      {transitionSeams.map(({ clip, seamTime }) => {
        const leftPx = seamTime * pixelsPerSecond;
        const activeTransition = clip.transitionIn;
        const isOpen = openTransitionClipId === clip.id;
        const activeLabel = activeTransition
          ? `${
              TRANSITION_OPTIONS.find((o) => o.type === activeTransition.type)?.label ??
              activeTransition.type
            } (${activeTransition.duration}s)`
          : 'Add transition';

        return (
          <div
            key={`transition-${clip.id}`}
            className={`timeline-transition-anchor ${isOpen ? 'open' : ''}`}
            style={{ left: `${leftPx}px` }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* Hover speech-bubble tooltip */}
            {!isOpen && (
              <div className="timeline-transition-tooltip">{activeLabel}</div>
            )}

            <button
              type="button"
              className={`timeline-transition-btn ${
                activeTransition ? 'timeline-transition-btn--active' : ''
              }`}
              onClick={() =>
                setOpenTransitionClipId((prev) => (prev === clip.id ? null : clip.id))
              }
              aria-label={activeLabel}
              aria-expanded={isOpen}
            >
              <TransitionIcon size={13} />
            </button>

            {isOpen && (
              <div className="timeline-transition-popover">
                <div className="timeline-transition-popover-title">Transition</div>
                <div className="timeline-transition-grid">
                  <button
                    type="button"
                    className={`timeline-transition-opt ${!activeTransition ? 'active' : ''}`}
                    onClick={() => {
                      updateClip(clip.id, { transitionIn: undefined });
                      setOpenTransitionClipId(null);
                    }}
                  >
                    None
                  </button>
                  {TRANSITION_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      type="button"
                      className={`timeline-transition-opt ${
                        activeTransition?.type === opt.type ? 'active' : ''
                      }`}
                      onClick={() => {
                        updateClip(clip.id, {
                          transitionIn: {
                            type: opt.type,
                            duration: activeTransition?.duration ?? 0.5,
                          },
                        });
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {activeTransition && (
                  <div className="timeline-transition-dur-row">
                    <span className="timeline-transition-dur-label">Duration</span>
                    <div className="timeline-transition-dur-btns">
                      {TRANSITION_DURATIONS.map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          className={`timeline-transition-dur-btn ${
                            activeTransition.duration === dur ? 'active' : ''
                          }`}
                          onClick={() =>
                            updateClip(clip.id, {
                              transitionIn: { ...activeTransition, duration: dur },
                            })
                          }
                        >
                          {dur}s
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
