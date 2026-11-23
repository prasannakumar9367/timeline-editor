import React, { useMemo, useRef, useEffect, useState } from 'react';
import './Preview.css';
import { useEditorStore } from '../../store/editorStore';
import { formatTime } from '../../utils/time';
import type { TimelineClip, MediaItem } from '../../types/editor';

export function getTextCoords(clip: TimelineClip): { x: number; y: number } {
  const x = clip.textX ?? 50;
  if (clip.textY !== undefined) {
    return { x, y: clip.textY };
  }
  const pos = clip.textPosition ?? 'bottom';
  const y = pos === 'top' ? 14 : pos === 'center' ? 50 : 86;
  return { x, y };
}

export default function Preview() {
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const mediaItems = useEditorStore((s) => s.mediaItems);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const isCropMode = useEditorStore((s) => s.isCropMode);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const addClip = useEditorStore((s) => s.addClip);
  const selectClip = useEditorStore((s) => s.selectClip);
  const updateClip = useEditorStore((s) => s.updateClip);
  const recordHistory = useEditorStore((s) => s.recordHistory);
  const setCropMode = useEditorStore((s) => s.setCropMode);

  const screenRef = useRef<HTMLDivElement>(null);

  // Synchronous Map of media items - no useRef render-lag!
  const mediaMap = useMemo(
    () => new Map(mediaItems.map((m) => [m.id, m])),
    [mediaItems]
  );

  // Track map for muting check
  const trackMutedMap = useMemo(
    () => new Map(tracks.map((t) => [t.id, t.muted])),
    [tracks]
  );

  // Track index map for proper visual layer ordering (video < image < text)
  const trackOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    tracks.forEach((t, index) => {
      const priority =
        t.type === 'text'
          ? 200 + index
          : t.type === 'image' || t.type === 'overlay'
          ? 100 + index
          : index;
      map.set(t.id, priority);
    });
    return map;
  }, [tracks]);

  // Active clips at currentTime
  const activeClips = useMemo(() => {
    return clips.filter((c) => {
      if (trackMutedMap.get(c.trackId)) return false;
      return currentTime >= c.startTime && currentTime < c.startTime + c.duration;
    });
  }, [clips, currentTime, trackMutedMap]);

  // Active visual clips (video / image / text subtitles) sorted by layer order
  const visualClips = useMemo(() => {
    return activeClips
      .filter(
        (c) =>
          c.mediaType === 'video' ||
          c.mediaType === 'image' ||
          c.mediaType === 'text'
      )
      .sort((a, b) => (trackOrderMap.get(a.trackId) ?? 0) - (trackOrderMap.get(b.trackId) ?? 0));
  }, [activeClips, trackOrderMap]);

  // Active audio clips
  const audioClips = useMemo(() => {
    return activeClips.filter((c) => c.mediaType === 'audio');
  }, [activeClips]);

  // Fallback: If no timeline clips at playhead, check if a media item is selected/available
  const fallbackMedia = useMemo(() => {
    if (visualClips.length > 0) return null;
    if (selectedMediaId && mediaMap.has(selectedMediaId)) {
      return mediaMap.get(selectedMediaId)!;
    }
    // Return the latest uploaded visual item if available
    for (let i = mediaItems.length - 1; i >= 0; i--) {
      if (mediaItems[i].type === 'image' || mediaItems[i].type === 'video') {
        return mediaItems[i];
      }
    }
    return null;
  }, [visualClips, selectedMediaId, mediaMap, mediaItems]);

  const topClip = visualClips.length > 0 ? visualClips[visualClips.length - 1] : null;
  const selectedActiveClip = useMemo(
    () => visualClips.find((c) => c.id === selectedClipId) ?? null,
    [visualClips, selectedClipId]
  );
  const activeCropClip =
    isCropMode &&
    selectedActiveClip &&
    (selectedActiveClip.mediaType === 'video' || selectedActiveClip.mediaType === 'image')
      ? selectedActiveClip
      : null;

  return (
    <div className="preview-container">
      <div
        ref={screenRef}
        className={`preview-screen ${selectedActiveClip ? 'preview-screen--has-selection' : ''}`}
        onClick={() => {
          if (!activeCropClip) togglePlay();
        }}
        title={activeCropClip ? 'Drag crop handles to crop' : 'Click to Play / Pause (Space)'}
      >
        {/* Case 1: Active timeline visual clips */}
        {visualClips.length > 0 ? (
          visualClips.map((clip, index) => {
            const isSelected = clip.id === selectedClipId;
            if (clip.mediaType === 'text') {
              return (
                <SubtitleClipRenderer
                  key={clip.id}
                  clip={clip}
                  zIndex={isSelected ? index + 40 : index + 20}
                  isSelected={isSelected}
                  screenRef={screenRef}
                  onSelect={selectClip}
                  onMoveStart={recordHistory}
                  onMove={(textX, textY) =>
                    updateClip(clip.id, { textX, textY }, { recordHistory: false })
                  }
                />
              );
            }
            const media = mediaMap.get(clip.mediaId);
            if (!media) return null;
            return (
              <VisualClipRenderer
                key={clip.id}
                clip={clip}
                media={media}
                currentTime={currentTime}
                isPlaying={isPlaying}
                zIndex={index + 1}
                isSelected={isSelected}
                isCropping={activeCropClip?.id === clip.id}
              />
            );
          })
        ) : fallbackMedia ? (
          /* Case 2: No clip at playhead, but user has uploaded media */
          <div className="preview-fallback-wrap">
            {fallbackMedia.type === 'image' ? (
              <img
                src={fallbackMedia.url}
                alt={fallbackMedia.name}
                className="preview-media preview-image"
              />
            ) : (
              <video
                src={fallbackMedia.url}
                className="preview-media preview-video"
                controls={false}
              />
            )}
            <div className="preview-fallback-banner" onClick={(e) => e.stopPropagation()}>
              <span>Preview: {fallbackMedia.name}</span>
              <button
                type="button"
                className="preview-add-to-timeline-btn"
                onClick={() => addClip(fallbackMedia.id)}
              >
                + Add to Timeline at playhead
              </button>
            </div>
          </div>
        ) : (
          /* Case 3: Empty project placeholder */
          <div className="preview-placeholder">
            <div className="preview-placeholder-icon-wrap">
              <svg
                className="preview-placeholder-icon"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <span className="preview-placeholder-text">
              No media at playhead — import media to begin
            </span>
          </div>
        )}

        {/* Audio Elements for Timeline Audio Clips */}
        {audioClips.map((clip) => {
          const media = mediaMap.get(clip.mediaId);
          if (!media) return null;
          return (
            <AudioClipRenderer
              key={clip.id}
              clip={clip}
              media={media}
              currentTime={currentTime}
              isPlaying={isPlaying}
            />
          );
        })}

        {/* Active Clip Name Badge */}
        {topClip && (
          <div className="preview-clip-name-badge">
            <span
              className="preview-clip-color-indicator"
              style={{ backgroundColor: topClip.color }}
            />
            <span className="preview-clip-name-label">{topClip.label}</span>
          </div>
        )}

        {/* Selected Clip Highlight Badge */}
        {selectedActiveClip && !activeCropClip && (
          <div className="preview-selected-badge">
            <span className="preview-selected-dot" />
            <span className="preview-selected-label">
              Selected: {selectedActiveClip.label}
              {selectedActiveClip.mediaType === 'text' ? ' · Drag to move' : ''}
            </span>
          </div>
        )}

        {/* Interactive Crop Overlay */}
        {activeCropClip && (
          <CropOverlay
            clip={activeCropClip}
            screenRef={screenRef}
            onCropStart={recordHistory}
            onCropChange={(updates) =>
              updateClip(activeCropClip.id, updates, { recordHistory: false })
            }
            onReset={() =>
              updateClip(activeCropClip.id, {
                cropTop: 0,
                cropRight: 0,
                cropBottom: 0,
                cropLeft: 0,
              })
            }
            onDone={() => setCropMode(false)}
          />
        )}

        {/* Timecode Badge */}
        <div className="preview-timecode-badge">
          <span
            className={`preview-status-indicator ${
              isPlaying ? 'preview-status-playing' : ''
            }`}
          />
          <span className="preview-timecode-value">{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  );
}

/* ──────────────── Subtitle / Text Renderer ──────────────── */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(0, 0, 0, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SubtitleProps {
  clip: TimelineClip;
  zIndex: number;
  isSelected: boolean;
  screenRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (clipId: string) => void;
  onMoveStart: () => void;
  onMove: (x: number, y: number) => void;
}

function SubtitleClipRenderer({
  clip,
  zIndex,
  isSelected,
  screenRef,
  onSelect,
  onMoveStart,
  onMove,
}: SubtitleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { x, y } = getTextCoords(clip);
  const fontSize = clip.fontSize ?? 32;
  const textColor = clip.textColor ?? '#ffffff';
  const bgHex = clip.textBgColor ?? '#000000';

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onSelect(clip.id);

    const screenEl = screenRef.current;
    if (!screenEl) return;

    const rect = screenEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const initialX = x;
    const initialY = y;
    let recorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startClientX;
      const dy = ev.clientY - startClientY;
      if (!recorded && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        onMoveStart();
        recorded = true;
        setIsDragging(true);
      }
      if (!recorded) return;

      const nextX = Math.max(5, Math.min(95, initialX + (dx / rect.width) * 100));
      const nextY = Math.max(5, Math.min(95, initialY + (dy / rect.height) * 100));
      onMove(Math.round(nextX * 10) / 10, Math.round(nextY * 10) / 10);
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  return (
    <div
      className="preview-subtitle-layer"
      style={{ zIndex, opacity: clip.opacity }}
    >
      <div
        className={`preview-subtitle-box ${
          isSelected ? 'preview-subtitle-box--selected' : ''
        } ${isDragging ? 'preview-subtitle-box--dragging' : ''}`}
        style={{
          left: `${x}%`,
          top: `${y}%`,
          fontSize: `${fontSize}px`,
          color: textColor,
          backgroundColor: hexToRgba(bgHex, 0.72),
        }}
        onPointerDown={handlePointerDown}
        onClick={(e) => e.stopPropagation()}
        title="Drag to move text"
      >
        {isSelected && (
          <>
            <span className="preview-handle preview-handle-tl" />
            <span className="preview-handle preview-handle-tr" />
            <span className="preview-handle preview-handle-bl" />
            <span className="preview-handle preview-handle-br" />
          </>
        )}
        {isDragging && (
          <div className="preview-subtitle-coords">
            {Math.round(x)}%, {Math.round(y)}%
          </div>
        )}
        {clip.text || clip.label}
      </div>
    </div>
  );
}

/* ──────────────── Visual Clip Renderer ──────────────── */
interface VisualProps {
  clip: TimelineClip;
  media: MediaItem;
  currentTime: number;
  isPlaying: boolean;
  zIndex: number;
  isSelected: boolean;
  isCropping: boolean;
}

function VisualClipRenderer({
  clip,
  media,
  currentTime,
  isPlaying,
  zIndex,
  isSelected,
  isCropping,
}: VisualProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const targetMediaTime = Math.max(
    0,
    currentTime - clip.startTime + clip.trimStart
  );

  useEffect(() => {
    if (clip.mediaType !== 'video' || !videoRef.current) return;
    const v = videoRef.current;
    if (Math.abs(v.currentTime - targetMediaTime) > 0.25) {
      v.currentTime = targetMediaTime;
    }
  }, [targetMediaTime, clip.mediaType]);

  useEffect(() => {
    if (clip.mediaType !== 'video' || !videoRef.current) return;
    const v = videoRef.current;
    if (isPlaying) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isPlaying, clip.mediaType]);

  const cropTop = clip.cropTop ?? 0;
  const cropRight = clip.cropRight ?? 0;
  const cropBottom = clip.cropBottom ?? 0;
  const cropLeft = clip.cropLeft ?? 0;
  const hasCrop = cropTop > 0 || cropRight > 0 || cropBottom > 0 || cropLeft > 0;
  const clipPathValue =
    !isCropping && hasCrop
      ? `inset(${cropTop}% ${cropRight}% ${cropBottom}% ${cropLeft}%)`
      : undefined;

  const highlightOverlay =
    isSelected && !isCropping ? (
      <div
        className="preview-clip-highlight"
        style={{
          zIndex: zIndex + 15,
          top: hasCrop ? `${cropTop}%` : '4px',
          right: hasCrop ? `${cropRight}%` : '4px',
          bottom: hasCrop ? `${cropBottom}%` : '4px',
          left: hasCrop ? `${cropLeft}%` : '4px',
        }}
        aria-hidden="true"
      >
        <span className="preview-corner preview-corner-tl" />
        <span className="preview-corner preview-corner-tr" />
        <span className="preview-corner preview-corner-bl" />
        <span className="preview-corner preview-corner-br" />
      </div>
    ) : null;

  if (clip.mediaType === 'image') {
    return (
      <>
        <img
          src={media.url}
          alt={clip.label}
          className="preview-media preview-image"
          style={{ opacity: clip.opacity, zIndex, clipPath: clipPathValue }}
        />
        {highlightOverlay}
      </>
    );
  }

  return (
    <>
      <video
        ref={videoRef}
        src={media.url}
        className="preview-media preview-video"
        style={{ opacity: clip.opacity, zIndex, clipPath: clipPathValue }}
        playsInline
        muted={false}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            videoRef.current.currentTime = targetMediaTime;
            videoRef.current.volume = clip.volume;
          }
        }}
      />
      {highlightOverlay}
    </>
  );
}

/* ──────────────── Interactive Crop Overlay ──────────────── */
type CropHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface CropOverlayProps {
  clip: TimelineClip;
  screenRef: React.RefObject<HTMLDivElement | null>;
  onCropStart: () => void;
  onCropChange: (updates: Partial<TimelineClip>) => void;
  onReset: () => void;
  onDone: () => void;
}

function CropOverlay({
  clip,
  screenRef,
  onCropStart,
  onCropChange,
  onReset,
  onDone,
}: CropOverlayProps) {
  const top = clip.cropTop ?? 0;
  const right = clip.cropRight ?? 0;
  const bottom = clip.cropBottom ?? 0;
  const left = clip.cropLeft ?? 0;

  const startHandleDrag = (handle: CropHandle) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const screenEl = screenRef.current;
    if (!screenEl) return;
    const rect = screenEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const init = { top, right, bottom, left };
    let recorded = false;
    const MIN_VISIBLE = 10;

    const onPointerMove = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startY) / rect.height) * 100;

      if (!recorded && (Math.abs(ev.clientX - startX) > 1 || Math.abs(ev.clientY - startY) > 1)) {
        onCropStart();
        recorded = true;
      }
      if (!recorded) return;

      const next: Partial<TimelineClip> = {};
      if (handle.includes('n')) {
        const val = Math.max(0, Math.min(100 - MIN_VISIBLE - init.bottom, init.top + dyPct));
        next.cropTop = Math.round(val * 10) / 10;
      }
      if (handle.includes('s')) {
        const val = Math.max(0, Math.min(100 - MIN_VISIBLE - init.top, init.bottom - dyPct));
        next.cropBottom = Math.round(val * 10) / 10;
      }
      if (handle.includes('w')) {
        const val = Math.max(0, Math.min(100 - MIN_VISIBLE - init.right, init.left + dxPct));
        next.cropLeft = Math.round(val * 10) / 10;
      }
      if (handle.includes('e')) {
        const val = Math.max(0, Math.min(100 - MIN_VISIBLE - init.left, init.right - dxPct));
        next.cropRight = Math.round(val * 10) / 10;
      }
      onCropChange(next);
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
      className="preview-crop-overlay"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="preview-crop-box"
        style={{
          top: `${top}%`,
          right: `${right}%`,
          bottom: `${bottom}%`,
          left: `${left}%`,
        }}
      >
        {/* Rule of thirds grid */}
        <div className="preview-crop-grid" aria-hidden="true">
          <span className="preview-crop-grid-v1" />
          <span className="preview-crop-grid-v2" />
          <span className="preview-crop-grid-h1" />
          <span className="preview-crop-grid-h2" />
        </div>

        {/* Edge handles */}
        <div className="preview-crop-edge preview-crop-edge-n" onPointerDown={startHandleDrag('n')} />
        <div className="preview-crop-edge preview-crop-edge-s" onPointerDown={startHandleDrag('s')} />
        <div className="preview-crop-edge preview-crop-edge-w" onPointerDown={startHandleDrag('w')} />
        <div className="preview-crop-edge preview-crop-edge-e" onPointerDown={startHandleDrag('e')} />

        {/* Corner handles */}
        <div className="preview-crop-corner preview-crop-corner-nw" onPointerDown={startHandleDrag('nw')} />
        <div className="preview-crop-corner preview-crop-corner-ne" onPointerDown={startHandleDrag('ne')} />
        <div className="preview-crop-corner preview-crop-corner-sw" onPointerDown={startHandleDrag('sw')} />
        <div className="preview-crop-corner preview-crop-corner-se" onPointerDown={startHandleDrag('se')} />
      </div>

      {/* Floating Crop Mode Toolbar */}
      <div className="preview-crop-bar">
        <span className="preview-crop-bar-label">
          Crop ({Math.round(100 - left - right)}% × {Math.round(100 - top - bottom)}%)
        </span>
        <button type="button" className="preview-crop-bar-btn" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="preview-crop-bar-btn preview-crop-bar-btn-primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

/* ──────────────── Audio Clip Renderer ──────────────── */
interface AudioProps {
  clip: TimelineClip;
  media: MediaItem;
  currentTime: number;
  isPlaying: boolean;
}

function AudioClipRenderer({
  clip,
  media,
  currentTime,
  isPlaying,
}: AudioProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const targetMediaTime = Math.max(
    0,
    currentTime - clip.startTime + clip.trimStart
  );

  useEffect(() => {
    if (!audioRef.current) return;
    const a = audioRef.current;
    if (Math.abs(a.currentTime - targetMediaTime) > 0.25) {
      a.currentTime = targetMediaTime;
    }
  }, [targetMediaTime]);

  useEffect(() => {
    if (!audioRef.current) return;
    const a = audioRef.current;
    if (isPlaying) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [isPlaying]);

  return (
    <audio
      ref={audioRef}
      src={media.url}
      style={{ display: 'none' }}
      onLoadedMetadata={() => {
        if (audioRef.current) {
          audioRef.current.currentTime = targetMediaTime;
          audioRef.current.volume = clip.volume;
        }
      }}
    />
  );
}
