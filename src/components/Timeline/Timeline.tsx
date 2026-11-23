import React, { useMemo, useRef, useState } from 'react';
import './Timeline.css';
import { useEditorStore } from '../../store/editorStore';
import { formatPreciseTime } from '../../utils/time';
import { TimelineRuler } from './TimelineRuler';
import { TimelineTrack } from './TimelineTrack';
import {
  MediaTypeIcon,
  FilmIcon,
  AudioIcon,
  ImageIcon,
  TextIcon,
  VolumeOnIcon,
  VolumeOffIcon,
  LockIcon,
  UnlockIcon,
  CloseIcon,
  ScissorsIcon,
  CopyIcon,
  LayerUpIcon,
  LayerDownIcon,
  TrashIcon,
  SkipBackIcon,
  SkipForwardIcon,
  PlayIcon,
  PauseIcon,
  CropIcon,
} from '../Icons/Icons';

export default function Timeline() {
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const duration = useEditorStore((s) => s.duration);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const pixelsPerSecond = useEditorStore((s) => s.pixelsPerSecond);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const isCropMode = useEditorStore((s) => s.isCropMode);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const selectClip = useEditorStore((s) => s.selectClip);
  const toggleCropMode = useEditorStore((s) => s.toggleCropMode);
  const toggleTrackMute = useEditorStore((s) => s.toggleTrackMute);
  const toggleTrackLock = useEditorStore((s) => s.toggleTrackLock);
  const addTrack = useEditorStore((s) => s.addTrack);
  const removeTrack = useEditorStore((s) => s.removeTrack);
  const splitClip = useEditorStore((s) => s.splitClip);
  const duplicateClip = useEditorStore((s) => s.duplicateClip);
  const moveClipTrack = useEditorStore((s) => s.moveClipTrack);
  const deleteClip = useEditorStore((s) => s.deleteClip);

  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const totalWidth = Math.max(900, duration * pixelsPerSecond);
  const playheadX = currentTime * pixelsPerSecond;

  const selectedClip = useMemo(
    () => clips.find((c) => c.id === selectedClipId) ?? null,
    [clips, selectedClipId]
  );

  const contentDuration = useMemo(() => {
    if (clips.length === 0) return duration;
    return Math.max(...clips.map((c) => c.startTime + c.duration));
  }, [clips, duration]);

  const canSplit = Boolean(
    selectedClip &&
      currentTime > selectedClip.startTime + 0.15 &&
      currentTime < selectedClip.startTime + selectedClip.duration - 0.15
  );
  const canCrop = Boolean(
    selectedClip && (selectedClip.mediaType === 'video' || selectedClip.mediaType === 'image')
  );

  const selectedTrackIdx = selectedClip
    ? tracks.findIndex((t) => t.id === selectedClip.trackId)
    : -1;
  const canMoveUp = selectedTrackIdx > 0;
  const canMoveDown = selectedTrackIdx !== -1 && selectedTrackIdx < tracks.length - 1;

  const handleSkipBack = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Jump to previous clip boundary or 0
    const boundaries = Array.from(
      new Set([0, ...clips.flatMap((c) => [c.startTime, c.startTime + c.duration])])
    ).sort((a, b) => a - b);
    const prev = [...boundaries].reverse().find((t) => t < currentTime - 0.05);
    setCurrentTime(prev ?? 0);
  };

  const handleSkipForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    const boundaries = Array.from(
      new Set([contentDuration, ...clips.flatMap((c) => [c.startTime, c.startTime + c.duration])])
    ).sort((a, b) => a - b);
    const next = boundaries.find((t) => t > currentTime + 0.05);
    setCurrentTime(next ?? contentDuration);
  };

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
      {/* ── Top Timeline Action & Transport Bar ── */}
      <div className="timeline-controls-bar" onClick={(e) => e.stopPropagation()}>
        <div className="timeline-controls-left">
          <button
            type="button"
            className="timeline-action-btn"
            disabled={!canSplit}
            onClick={() => selectedClip && splitClip(selectedClip.id)}
            title={
              canSplit
                ? 'Split selected clip at playhead'
                : 'Select a clip and place the playhead inside it to split'
            }
            aria-label="Split clip"
          >
            <ScissorsIcon size={16} />
          </button>
          <button
            type="button"
            className={`timeline-action-btn ${isCropMode && canCrop ? 'timeline-action-btn-active' : ''}`}
            disabled={!canCrop}
            onClick={toggleCropMode}
            title={
              canCrop
                ? isCropMode
                  ? 'Exit crop mode'
                  : 'Crop selected video or image in preview'
                : 'Select a video or image clip to crop'
            }
            aria-label="Crop clip"
            aria-pressed={isCropMode && canCrop}
          >
            <CropIcon size={16} />
          </button>
          <button
            type="button"
            className="timeline-action-btn"
            disabled={!selectedClip}
            onClick={() => selectedClip && duplicateClip(selectedClip.id)}
            title="Duplicate selected clip (Ctrl+D)"
            aria-label="Duplicate clip"
          >
            <CopyIcon size={16} />
          </button>
          <button
            type="button"
            className="timeline-action-btn"
            disabled={!canMoveUp}
            onClick={() => selectedClip && moveClipTrack(selectedClip.id, 'up')}
            title="Move clip to track above"
            aria-label="Move clip up"
          >
            <LayerUpIcon size={16} />
          </button>
          <button
            type="button"
            className="timeline-action-btn"
            disabled={!canMoveDown}
            onClick={() => selectedClip && moveClipTrack(selectedClip.id, 'down')}
            title="Move clip to track below"
            aria-label="Move clip down"
          >
            <LayerDownIcon size={16} />
          </button>
          <button
            type="button"
            className="timeline-action-btn timeline-action-btn-danger"
            disabled={!selectedClip}
            onClick={() => selectedClip && deleteClip(selectedClip.id)}
            title="Delete selected clip (Delete)"
            aria-label="Delete clip"
          >
            <TrashIcon size={16} />
          </button>
        </div>

        <div className="timeline-controls-center">
          <button
            type="button"
            className="timeline-transport-btn"
            onClick={handleSkipBack}
            title="Previous cut / Jump to start"
            aria-label="Skip back"
          >
            <SkipBackIcon size={14} />
          </button>
          <button
            type="button"
            className={`timeline-play-circle-btn ${isPlaying ? 'playing' : ''}`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
          </button>
          <button
            type="button"
            className="timeline-transport-btn"
            onClick={handleSkipForward}
            title="Next cut / Jump to end"
            aria-label="Skip forward"
          >
            <SkipForwardIcon size={14} />
          </button>

          <div className="timeline-transport-time" title="Current time / Content duration">
            <span className="timeline-transport-current">{formatPreciseTime(currentTime)}</span>
            <span className="timeline-transport-sep">/</span>
            <span className="timeline-transport-total">{formatPreciseTime(contentDuration)}</span>
          </div>
        </div>

        <div className="timeline-controls-right" />
      </div>

      {/* ── Main Split Workspace (Track Headers + Scrollable Lanes) ── */}
      <div className="timeline-workspace">
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
                  <FilmIcon size={13} />
                  <span>Add Video Track</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addTrack('audio');
                    setAddMenuOpen(false);
                  }}
                >
                  <AudioIcon size={13} />
                  <span>Add Audio Track</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addTrack('image');
                    setAddMenuOpen(false);
                  }}
                >
                  <ImageIcon size={13} />
                  <span>Add Image Track</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addTrack('text');
                    setAddMenuOpen(false);
                  }}
                >
                  <TextIcon size={13} />
                  <span>Add Text Track</span>
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
                <span className="timeline-track-icon">
                  <MediaTypeIcon type={t.type} size={14} />
                </span>
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
                  {t.muted ? <VolumeOffIcon size={13} /> : <VolumeOnIcon size={13} />}
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
                  {t.locked ? <LockIcon size={13} /> : <UnlockIcon size={13} />}
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
                    <CloseIcon size={12} />
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
    </div>
  );
}

export { TimelineClip } from './TimelineClip';
export { TimelineTrack } from './TimelineTrack';
export { TimelineRuler } from './TimelineRuler';
