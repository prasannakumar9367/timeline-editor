import React, { useRef, useState } from 'react';
import './Timeline.css';
import { useEditorStore } from '../../store/editorStore';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';

export default function Timeline() {
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const pixelsPerSecond = useEditorStore((s) => s.pixelsPerSecond);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const selectClip = useEditorStore((s) => s.selectClip);
  const toggleTrackMute = useEditorStore((s) => s.toggleTrackMute);
  const toggleTrackLock = useEditorStore((s) => s.toggleTrackLock);
  const addTrack = useEditorStore((s) => s.addTrack);
  const removeTrack = useEditorStore((s) => s.removeTrack);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const totalWidth = Math.max(900, duration * pixelsPerSecond);
  const playheadX = currentTime * pixelsPerSecond;

  // Handle playhead drag
  const handlePlayheadPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !scrollContainerRef.current) return;
    e.stopPropagation();

    const container = scrollContainerRef.current;
    const rect = container.getBoundingClientRect();

    const updateTime = (clientX: number) => {
      const offsetX = Math.max(0, clientX - rect.left + container.scrollLeft);
      const newTime = Math.min(duration, offsetX / pixelsPerSecond);
      setCurrentTime(newTime);
    };

    updateTime(e.clientX);

    const onPointerMove = (ev: PointerEvent) => {
      updateTime(ev.clientX);
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
      className="timeline-root"
      onClick={() => selectClip(null)}
    >
      {/* ── Left Headers Column ── */}
      <div className="timeline-headers-col">
        {/* Top corner above ruler */}
        <div className="timeline-headers-corner">
          <span className="timeline-headers-title">TRACKS</span>
          <div className="timeline-add-track-dropdown-wrapper">
            <button
              type="button"
              className="timeline-add-track-trigger-btn"
              onClick={(e) => {
                e.stopPropagation();
                setAddMenuOpen((prev) => !prev);
              }}
              title="Add a new track"
            >
              + Track
            </button>
            {addMenuOpen && (
              <div
                className="timeline-add-track-menu"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => {
                    addTrack('video');
                    setAddMenuOpen(false);
                  }}
                >
                  🎬 Add Video Track
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addTrack('audio');
                    setAddMenuOpen(false);
                  }}
                >
                  🎙️ Add Audio Track
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addTrack('image');
                    setAddMenuOpen(false);
                  }}
                >
                  🖼️ Add Image Track
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addTrack('text');
                    setAddMenuOpen(false);
                  }}
                >
                  💬 Add Text Track
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Track Label Rows */}
        <div className="timeline-headers-list">
          {tracks.map((t) => (
            <div key={t.id} className="timeline-track-header">
              <div className="timeline-track-info">
                <span className="timeline-track-icon">{t.icon}</span>
                <span className="timeline-track-name" title={t.name}>
                  {t.name}
                </span>
              </div>
              <div className="timeline-track-controls">
                <button
                  type="button"
                  className={`timeline-track-btn ${t.muted ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrackMute(t.id);
                  }}
                  title={t.muted ? 'Unmute track' : 'Mute track'}
                >
                  {t.muted ? '🔇' : '🔊'}
                </button>
                <button
                  type="button"
                  className={`timeline-track-btn ${t.locked ? 'active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTrackLock(t.id);
                  }}
                  title={t.locked ? 'Unlock track' : 'Lock track'}
                >
                  {t.locked ? '🔒' : '🔓'}
                </button>
                {tracks.length > 1 && (
                  <button
                    type="button"
                    className="timeline-track-btn timeline-track-btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTrack(t.id);
                    }}
                    title="Remove track"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Scrollable Timeline Canvas Area ── */}
      <div className="timeline-scroll-area" ref={scrollContainerRef}>
        <div className="timeline-content-wrapper" style={{ width: `${totalWidth}px` }}>
          {/* Ruler */}
          <TimelineRuler totalWidth={totalWidth} />

          {/* Track Lanes */}
          <div className="timeline-lanes-container">
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                clips={clips.filter((c) => c.trackId === track.id)}
                totalWidth={totalWidth}
              />
            ))}

            {/* Playhead Marker & Needle */}
            <div
              className="timeline-playhead"
              style={{ left: `${playheadX}px` }}
              onPointerDown={handlePlayheadPointerDown}
            >
              <div className="timeline-playhead-needle" />
              <div className="timeline-playhead-line" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { TimelineClip } from './TimelineClip';
export { TimelineTrack } from './TimelineTrack';
export { TimelineRuler } from './TimelineRuler';
