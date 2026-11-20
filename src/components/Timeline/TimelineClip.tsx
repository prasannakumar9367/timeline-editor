import React, { useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { TimelineClip as ClipType } from '../../types/editor';
import { AudioWaveform } from './AudioWaveform';

interface TimelineClipProps {
  clip: ClipType;
}

export const TimelineClip: React.FC<TimelineClipProps> = ({ clip }) => {
  const pixelsPerSecond = useEditorStore((s) => s.pixelsPerSecond);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectClip = useEditorStore((s) => s.selectClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const trimClipStart = useEditorStore((s) => s.trimClipStart);
  const trimClipEnd = useEditorStore((s) => s.trimClipEnd);
  const recordHistory = useEditorStore((s) => s.recordHistory);
  const mediaItem = useEditorStore((s) =>
    clip.mediaType === 'audio' ? s.mediaItems.find((m) => m.id === clip.mediaId) : undefined
  );

  const isSelected = selectedClipId === clip.id;
  const isAudio = clip.mediaType === 'audio';
  const leftPx = clip.startTime * pixelsPerSecond;
  const widthPx = Math.max(12, clip.duration * pixelsPerSecond);

  const dragStartRef = useRef<{
    startX: number;
    initialStartTime: number;
    initialTrimStart: number;
    initialDuration: number;
  }>({
    startX: 0,
    initialStartTime: 0,
    initialTrimStart: 0,
    initialDuration: 0,
  });

  // ── Drag to move ──
  const handleBodyPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectClip(clip.id);

    const startX = e.clientX;
    const initialStartTime = clip.startTime;
    let recorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      const deltaPx = ev.clientX - startX;
      if (!recorded && Math.abs(deltaPx) > 2) {
        recordHistory();
        recorded = true;
      }
      if (!recorded) return;
      const deltaTime = deltaPx / pixelsPerSecond;
      const newStart = Math.max(0, initialStartTime + deltaTime);
      moveClip(clip.id, newStart, clip.trackId);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // ── Left trim handle ──
  const handleLeftTrimPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectClip(clip.id);

    dragStartRef.current = {
      startX: e.clientX,
      initialStartTime: clip.startTime,
      initialTrimStart: clip.trimStart,
      initialDuration: clip.duration,
    };
    let recorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      const { startX, initialStartTime, initialTrimStart, initialDuration } = dragStartRef.current;
      const deltaPx = ev.clientX - startX;
      if (!recorded && Math.abs(deltaPx) > 1) {
        recordHistory();
        recorded = true;
      }
      if (!recorded) return;
      const deltaTime = deltaPx / pixelsPerSecond;

      // Ensure we don't trim past duration min (0.25s) or negative trimStart
      const maxDelta = initialDuration - 0.25;
      const clampedDelta = Math.min(maxDelta, Math.max(-initialTrimStart, deltaTime));

      const newStart = Math.max(0, initialStartTime + clampedDelta);
      const newTrim = Math.max(0, initialTrimStart + clampedDelta);
      const newDur = Math.max(0.25, initialDuration - clampedDelta);

      trimClipStart(clip.id, newStart, newTrim, newDur);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // ── Right trim handle ──
  const handleRightTrimPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    selectClip(clip.id);

    dragStartRef.current = {
      startX: e.clientX,
      initialStartTime: clip.startTime,
      initialTrimStart: clip.trimStart,
      initialDuration: clip.duration,
    };
    let recorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      const { startX, initialDuration } = dragStartRef.current;
      const deltaPx = ev.clientX - startX;
      if (!recorded && Math.abs(deltaPx) > 1) {
        recordHistory();
        recorded = true;
      }
      if (!recorded) return;
      const deltaTime = deltaPx / pixelsPerSecond;
      const newDur = Math.max(0.25, initialDuration + deltaTime);

      trimClipEnd(clip.id, newDur);
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
      className={`timeline-clip ${isSelected ? 'timeline-clip-selected' : ''} ${
        isAudio ? 'timeline-clip-audio' : ''
      }`}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        backgroundColor: isAudio ? undefined : clip.color,
        borderColor: isAudio ? clip.color : undefined,
        opacity: clip.opacity,
      }}
      onPointerDown={handleBodyPointerDown}
      onClick={(e) => {
        e.stopPropagation();
        selectClip(clip.id);
      }}
    >
      {/* Audio Waveform Background */}
      {isAudio && (
        <AudioWaveform
          media={mediaItem}
          trimStart={clip.trimStart}
          duration={clip.duration}
          widthPx={widthPx}
          color={clip.color}
          volume={clip.volume}
        />
      )}

      {/* Left Trim Handle */}
      <div
        className="timeline-clip-handle timeline-clip-handle-left"
        onPointerDown={handleLeftTrimPointerDown}
        title="Trim Start"
      />

      {/* Clip Content */}
      <div className={`timeline-clip-body ${isAudio ? 'timeline-clip-body-audio' : ''}`}>
        {clip.mediaType === 'text' ? (
          <span style={{ fontSize: '14px', flexShrink: 0 }}>💬</span>
        ) : isAudio ? (
          <span className="timeline-clip-audio-badge">🎵</span>
        ) : clip.thumbnail ? (
          <img
            src={clip.thumbnail}
            alt=""
            className="timeline-clip-thumb"
            draggable={false}
          />
        ) : null}
        <span className="timeline-clip-label">
          {clip.mediaType === 'text' ? clip.text || clip.label : clip.label}
        </span>
        <span className="timeline-clip-duration">{clip.duration.toFixed(1)}s</span>
      </div>

      {/* Right Trim Handle */}
      <div
        className="timeline-clip-handle timeline-clip-handle-right"
        onPointerDown={handleRightTrimPointerDown}
        title="Trim End"
      />
    </div>
  );
};
