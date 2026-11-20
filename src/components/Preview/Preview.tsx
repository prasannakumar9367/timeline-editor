import React, { useMemo, useRef, useEffect } from 'react';
import './Preview.css';
import { useEditorStore } from '../../store/editorStore';
import { formatTime } from '../../utils/time';
import type { TimelineClip, MediaItem } from '../../types/editor';

export default function Preview() {
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const clips = useEditorStore((s) => s.clips);
  const tracks = useEditorStore((s) => s.tracks);
  const mediaItems = useEditorStore((s) => s.mediaItems);
  const selectedMediaId = useEditorStore((s) => s.selectedMediaId);
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const addClip = useEditorStore((s) => s.addClip);

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

  // Track index map for proper visual layer ordering (overlays on top)
  const trackOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    tracks.forEach((t, index) => {
      // Overlay tracks rendered above video tracks
      const priority = t.type === 'overlay' ? 100 + index : index;
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

  return (
    <div className="preview-container">
      <div
        className="preview-screen"
        onClick={togglePlay}
        title="Click to Play / Pause (Space)"
      >
        {/* Case 1: Active timeline visual clips */}
        {visualClips.length > 0 ? (
          visualClips.map((clip, index) => {
            if (clip.mediaType === 'text') {
              return (
                <SubtitleClipRenderer
                  key={clip.id}
                  clip={clip}
                  zIndex={index + 20}
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

function SubtitleClipRenderer({
  clip,
  zIndex,
}: {
  clip: TimelineClip;
  zIndex: number;
}) {
  const pos = clip.textPosition ?? 'bottom';
  const fontSize = clip.fontSize ?? 32;
  const textColor = clip.textColor ?? '#ffffff';
  const bgHex = clip.textBgColor ?? '#000000';

  return (
    <div
      className={`preview-subtitle-layer preview-subtitle-${pos}`}
      style={{ zIndex, opacity: clip.opacity }}
    >
      <div
        className="preview-subtitle-box"
        style={{
          fontSize: `${fontSize}px`,
          color: textColor,
          backgroundColor: hexToRgba(bgHex, 0.72),
        }}
      >
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
}

function VisualClipRenderer({
  clip,
  media,
  currentTime,
  isPlaying,
  zIndex,
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

  if (clip.mediaType === 'image') {
    return (
      <img
        src={media.url}
        alt={clip.label}
        className="preview-media preview-image"
        style={{ opacity: clip.opacity, zIndex }}
      />
    );
  }

  return (
    <video
      ref={videoRef}
      src={media.url}
      className="preview-media preview-video"
      style={{ opacity: clip.opacity, zIndex }}
      playsInline
      muted={false}
      onLoadedMetadata={() => {
        if (videoRef.current) {
          videoRef.current.currentTime = targetMediaTime;
          videoRef.current.volume = clip.volume;
        }
      }}
    />
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
