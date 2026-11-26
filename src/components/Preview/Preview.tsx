import React, { useMemo, useRef, useEffect, useState } from 'react';
import './Preview.css';
import { useEditorStore } from '../../store/editorStore';
import { formatPreciseTime } from '../../utils/time';
import { PlayIcon, PauseIcon, CloseIcon, DownloadIcon, CropIcon } from '../Icons/Icons';
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
  const isFullPreview = useEditorStore((s) => s.isFullPreview);
  const duration = useEditorStore((s) => s.duration);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const addClip = useEditorStore((s) => s.addClip);
  const selectClip = useEditorStore((s) => s.selectClip);
  const updateClip = useEditorStore((s) => s.updateClip);
  const recordHistory = useEditorStore((s) => s.recordHistory);
  const setCropMode = useEditorStore((s) => s.setCropMode);
  const setFullPreview = useEditorStore((s) => s.setFullPreview);
  const openExportModal = useEditorStore((s) => s.openExportModal);

  const containerRef = useRef<HTMLDivElement>(null);
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

  const selectedActiveClip = useMemo(
    () => (isFullPreview ? null : visualClips.find((c) => c.id === selectedClipId) ?? null),
    [visualClips, selectedClipId, isFullPreview]
  );
  const activeCropClip =
    !isFullPreview &&
    isCropMode &&
    selectedActiveClip &&
    (selectedActiveClip.mediaType === 'video' || selectedActiveClip.mediaType === 'image')
      ? selectedActiveClip
      : null;

  const contentEnd = useMemo(() => {
    const unmuted = clips.filter((c) => !trackMutedMap.get(c.trackId));
    if (unmuted.length === 0) return duration;
    return Math.max(...unmuted.map((c) => c.startTime + c.duration));
  }, [clips, trackMutedMap, duration]);

  const handleExitFullPreview = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
    setFullPreview(false);
  };

  const handleToggleBrowserFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else if (containerRef.current?.requestFullscreen) {
      void containerRef.current.requestFullscreen().catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className={`preview-container ${isFullPreview ? 'preview-container--fullscreen' : ''}`}
    >
      <div
        ref={screenRef}
        className={`preview-screen ${selectedActiveClip ? 'preview-screen--has-selection' : ''} ${
          isFullPreview ? 'preview-screen--fullscreen' : ''
        }`}
        onClick={() => {
          if (!activeCropClip && clips.length > 0) togglePlay();
        }}
        title={
          clips.length === 0
            ? 'Import media to begin'
            : activeCropClip
            ? 'Drag crop handles to crop'
            : 'Click to Play / Pause (Space)'
        }
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
                isSelected={isSelected && !isFullPreview}
                isCropping={activeCropClip?.id === clip.id}
                screenRef={screenRef}
                onTransformStart={recordHistory}
                onTransformChange={(updates) =>
                  updateClip(clip.id, updates, { recordHistory: false })
                }
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

        {/* Selected Clip Quick Transform / Crop Bar */}
        {selectedActiveClip &&
          !activeCropClip &&
          !isFullPreview &&
          (selectedActiveClip.mediaType === 'video' ||
            selectedActiveClip.mediaType === 'image') && (
            <div
              className="preview-transform-bar"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="preview-transform-size">
                {Math.round((selectedActiveClip.scale ?? 1) * 100)}%
              </span>
              {((selectedActiveClip.scale ?? 1) !== 1 ||
                (selectedActiveClip.posX ?? 0) !== 0 ||
                (selectedActiveClip.posY ?? 0) !== 0) && (
                <button
                  type="button"
                  className="preview-crop-bar-btn"
                  onClick={() =>
                    updateClip(selectedActiveClip.id, { scale: 1, posX: 0, posY: 0 })
                  }
                  title="Reset size and position"
                >
                  Fit
                </button>
              )}
              <button
                type="button"
                className="preview-crop-bar-btn preview-crop-bar-btn-primary"
                onClick={() => setCropMode(true)}
                title="Crop selected clip"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              >
                <CropIcon size={12} />
                <span>Crop</span>
              </button>
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

        {/* Timecode Badge (hidden in fullscreen where full transport bar is shown)
        {!isFullPreview && (
          <div className="preview-timecode-badge">
            <span
              className={`preview-status-indicator ${
                isPlaying ? 'preview-status-playing' : ''
              }`}
            />
           
          </div>
        )} */}
      </div>

      {/* Fullscreen Cinema Transport Bar */}
      {isFullPreview && (
        <div
          className="preview-fullscreen-bar"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="preview-fs-play-btn"
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <PauseIcon size={15} /> : <PlayIcon size={15} />}
          </button>

          <span className="preview-fs-time">
            <strong>{formatPreciseTime(currentTime)}</strong>
            <span className="preview-fs-sep">/</span>
            <span>{formatPreciseTime(contentEnd)}</span>
          </span>

          <input
            type="range"
            className="preview-fs-scrubber"
            min={0}
            max={Math.max(0.1, contentEnd)}
            step={0.05}
            value={Math.min(currentTime, contentEnd)}
            onChange={(e) => setCurrentTime(Number(e.target.value))}
            aria-label="Preview playback position"
          />

          <button
            type="button"
            className="preview-fs-btn"
            onClick={handleToggleBrowserFullscreen}
            title="Toggle Browser Fullscreen"
          >
            ⛶ Fullscreen
          </button>

          <button
            type="button"
            className="preview-fs-btn preview-fs-btn-primary"
            onClick={() => {
              if (document.fullscreenElement) {
                void document.exitFullscreen().catch(() => {});
              }
              openExportModal();
            }}
          >
            <DownloadIcon size={14} />
            <span>Export</span>
          </button>

          <button
            type="button"
            className="preview-fs-btn"
            onClick={handleExitFullPreview}
            title="Exit Fullscreen Preview (Esc)"
          >
            <CloseIcon size={13} />
            <span>Exit</span>
          </button>
        </div>
      )}
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
  screenRef: React.RefObject<HTMLDivElement | null>;
  onTransformStart: () => void;
  onTransformChange: (updates: Partial<TimelineClip>) => void;
}

function VisualClipRenderer({
  clip,
  media,
  currentTime,
  isPlaying,
  zIndex,
  isSelected,
  isCropping,
  screenRef,
  onTransformStart,
  onTransformChange,
}: VisualProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragLabel, setDragLabel] = useState<string | null>(null);

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
    v.volume = Math.max(0, Math.min(1, clip.volume));
  }, [clip.volume, clip.mediaType]);

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

  // Compute live incoming transition style (fade, slide, zoom, wipe)
  let transitionOpacity = 1;
  let transitionTransform: string | undefined;
  let wipeRightPct = 0;

  if (clip.transitionIn && clip.transitionIn.duration > 0) {
    const elapsedInClip = currentTime - clip.startTime;
    const dur = Math.min(clip.transitionIn.duration, clip.duration);
    if (elapsedInClip >= 0 && elapsedInClip < dur) {
      const rawP = Math.max(0, Math.min(1, elapsedInClip / dur));
      // Smooth ease-out curve
      const p = 1 - Math.pow(1 - rawP, 2);
      switch (clip.transitionIn.type) {
        case 'fade':
          transitionOpacity = p;
          break;
        case 'slide-left':
          transitionTransform = `translateX(${(1 - p) * 100}%)`;
          break;
        case 'slide-right':
          transitionTransform = `translateX(${-(1 - p) * 100}%)`;
          break;
        case 'zoom':
          transitionTransform = `scale(${0.75 + p * 0.25})`;
          transitionOpacity = p;
          break;
        case 'wipe':
          wipeRightPct = (1 - p) * 100;
          break;
      }
    }
  }

  const effectiveRight = Math.max(cropRight, wipeRightPct);
  const clipPathValue =
    !isCropping && (hasCrop || wipeRightPct > 0)
      ? `inset(${cropTop}% ${effectiveRight}% ${cropBottom}% ${cropLeft}%)`
      : undefined;

  const scale = clip.scale ?? 1;
  const posX = clip.posX ?? 0;
  const posY = clip.posY ?? 0;

  const transformParts: string[] = [];
  if (posX !== 0 || posY !== 0) {
    transformParts.push(`translate(${posX}%, ${posY}%)`);
  }
  if (scale !== 1) {
    transformParts.push(`scale(${scale})`);
  }
  if (transitionTransform) {
    transformParts.push(transitionTransform);
  }
  const combinedTransform = transformParts.length > 0 ? transformParts.join(' ') : undefined;

  const mediaStyle: React.CSSProperties = {
    opacity: clip.opacity * transitionOpacity,
    zIndex,
    clipPath: clipPathValue,
    transform: combinedTransform,
  };

  // Drag corner handle to resize clip smoothly
  const handleResizePointerDown =
    (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();

      const screenEl = screenRef.current;
      if (!screenEl) return;
      const rect = screenEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const initialScale = scale;
      const signX = corner.includes('e') ? 1 : -1;
      const signY = corner.includes('s') ? 1 : -1;
      let recorded = false;

      const onPointerMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - startX) * signX;
        const dy = (ev.clientY - startY) * signY;
        if (!recorded && (Math.abs(ev.clientX - startX) > 1 || Math.abs(ev.clientY - startY) > 1)) {
          onTransformStart();
          recorded = true;
        }
        if (!recorded) return;

        // Average diagonal drag relative to preview size
        const deltaRatio = (dx / rect.width + dy / rect.height) * 1.15;
        const nextScale = Math.max(0.15, Math.min(3, initialScale + deltaRatio));
        const rounded = Math.round(nextScale * 100) / 100;
        setDragLabel(`${Math.round(rounded * 100)}%`);
        onTransformChange({ scale: rounded });
      };

      const onPointerUp = () => {
        setDragLabel(null);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

  // Drag inside selected frame to move clip position
  const handleMovePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();

    const screenEl = screenRef.current;
    if (!screenEl) return;
    const rect = screenEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = posX;
    const initialY = posY;
    let recorded = false;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!recorded && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
        onTransformStart();
        recorded = true;
      }
      if (!recorded) return;

      const nextX = Math.max(-90, Math.min(90, initialX + (dx / rect.width) * 100));
      const nextY = Math.max(-90, Math.min(90, initialY + (dy / rect.height) * 100));
      const rx = Math.round(nextX * 10) / 10;
      const ry = Math.round(nextY * 10) / 10;
      setDragLabel(`X:${Math.round(rx)}% Y:${Math.round(ry)}%`);
      onTransformChange({ posX: rx, posY: ry });
    };

    const onPointerUp = () => {
      setDragLabel(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const highlightOverlay =
    isSelected && !isCropping ? (
      <div
        className="preview-clip-highlight preview-clip-highlight--interactive"
        style={{
          zIndex: zIndex + 15,
          top: hasCrop ? `${cropTop}%` : '4px',
          right: hasCrop ? `${cropRight}%` : '4px',
          bottom: hasCrop ? `${cropBottom}%` : '4px',
          left: hasCrop ? `${cropLeft}%` : '4px',
          transform:
            posX !== 0 || posY !== 0 || scale !== 1
              ? `translate(${posX}%, ${posY}%) scale(${scale})`
              : undefined,
        }}
        onPointerDown={handleMovePointerDown}
        onClick={(e) => e.stopPropagation()}
        title="Drag to move · Drag corners to resize"
      >
        {dragLabel && <div className="preview-drag-pill">{dragLabel}</div>}
        <span
          className="preview-corner preview-corner-tl preview-corner-resize"
          onPointerDown={handleResizePointerDown('nw')}
        />
        <span
          className="preview-corner preview-corner-tr preview-corner-resize"
          onPointerDown={handleResizePointerDown('ne')}
        />
        <span
          className="preview-corner preview-corner-bl preview-corner-resize"
          onPointerDown={handleResizePointerDown('sw')}
        />
        <span
          className="preview-corner preview-corner-br preview-corner-resize"
          onPointerDown={handleResizePointerDown('se')}
        />
      </div>
    ) : null;

  if (clip.mediaType === 'image') {
    return (
      <>
        <img
          src={media.url}
          alt={clip.label}
          className="preview-media preview-image"
          style={mediaStyle}
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
        style={mediaStyle}
        preload="auto"
        playsInline
        muted={false}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            videoRef.current.currentTime = targetMediaTime;
            videoRef.current.volume = Math.max(0, Math.min(1, clip.volume));
            if (isPlaying) videoRef.current.play().catch(() => {});
          }
        }}
        onCanPlay={() => {
          if (videoRef.current && isPlaying && videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
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

      {/* Floating Crop Mode Toolbar with Aspect Presets */}
      <div className="preview-crop-bar">
        <span className="preview-crop-bar-label">
          {Math.round(100 - left - right)}% × {Math.round(100 - top - bottom)}%
        </span>
        {(
          [
            { label: '16:9', top: 0, right: 0, bottom: 0, left: 0 },
            { label: '4:3', top: 0, right: 12.5, bottom: 0, left: 12.5 },
            { label: '1:1', top: 0, right: 21.9, bottom: 0, left: 21.9 },
            { label: '9:16', top: 0, right: 34.2, bottom: 0, left: 34.2 },
          ] as const
        ).map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="preview-crop-bar-btn"
            onClick={() => {
              onCropStart();
              onCropChange({
                cropTop: preset.top,
                cropRight: preset.right,
                cropBottom: preset.bottom,
                cropLeft: preset.left,
              });
            }}
            title={`Crop to ${preset.label}`}
          >
            {preset.label}
          </button>
        ))}
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
  const spokeRef = useRef(false);
  const targetMediaTime = Math.max(
    0,
    currentTime - clip.startTime + clip.trimStart
  );

  // Text-to-Speech live playback via Web Speech API
  useEffect(() => {
    if (!clip.ttsText || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    if (isPlaying && !spokeRef.current) {
      spokeRef.current = true;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(clip.ttsText);
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.name === clip.ttsVoice);
      if (match) utterance.voice = match;
      utterance.rate = clip.ttsRate ?? 1;
      utterance.pitch = clip.ttsPitch ?? 1;
      utterance.volume = Math.max(0, Math.min(1, clip.volume));
      window.speechSynthesis.speak(utterance);
    } else if (!isPlaying && spokeRef.current) {
      spokeRef.current = false;
      window.speechSynthesis.cancel();
    }
  }, [isPlaying, clip.ttsText, clip.ttsVoice, clip.ttsRate, clip.ttsPitch, clip.volume]);

  useEffect(() => {
    return () => {
      if (clip.ttsText && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clip.ttsText]);

  useEffect(() => {
    if (clip.ttsText || !audioRef.current) return;
    audioRef.current.volume = Math.max(0, Math.min(1, clip.volume));
  }, [clip.volume, clip.ttsText]);

  useEffect(() => {
    if (clip.ttsText || !audioRef.current) return;
    const a = audioRef.current;
    if (Math.abs(a.currentTime - targetMediaTime) > 0.25) {
      a.currentTime = targetMediaTime;
    }
  }, [targetMediaTime, clip.ttsText]);

  useEffect(() => {
    if (clip.ttsText || !audioRef.current) return;
    const a = audioRef.current;
    if (isPlaying) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [isPlaying, clip.ttsText]);

  if (clip.ttsText) return null;

  return (
    <audio
      ref={audioRef}
      src={media.url}
      preload="auto"
      style={{ display: 'none' }}
      onLoadedMetadata={() => {
        if (audioRef.current) {
          audioRef.current.currentTime = targetMediaTime;
          audioRef.current.volume = Math.max(0, Math.min(1, clip.volume));
          if (isPlaying) audioRef.current.play().catch(() => {});
        }
      }}
      onCanPlay={() => {
        if (audioRef.current && isPlaying && audioRef.current.paused) {
          audioRef.current.play().catch(() => {});
        }
      }}
    />
  );
}
