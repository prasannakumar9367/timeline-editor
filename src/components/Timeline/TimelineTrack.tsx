import React, { useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { Track, TimelineClip as ClipType, LibraryDragData } from '../../types/editor';
import { TimelineClip } from './TimelineClip';

interface TimelineTrackProps {
  track: Track;
  clips: ClipType[];
  totalWidth: number;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  clips,
  totalWidth,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const pixelsPerSecond = useEditorStore((s) => s.pixelsPerSecond);
  const addClip = useEditorStore((s) => s.addClip);

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
    </div>
  );
};
