import type { MediaItem, TimelineClip, Track } from '../types/editor';

export type ExportFormat = 'mp4' | 'webm';

export interface ExportOptions {
  width: number;
  height: number;
  fps: number;
  filename: string;
  format?: ExportFormat;
  startTime?: number;
  endTime?: number;
  onProgress?: (percent: number, currentTime: number, totalDuration: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  extension: string;
  filename: string;
  sizeBytes: number;
}

/** Check which container formats the current browser's MediaRecorder supports. */
export function getSupportedExportFormats(): { mp4: boolean; webm: boolean } {
  if (typeof MediaRecorder === 'undefined') {
    return { mp4: false, webm: false };
  }
  const mp4Candidates = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ];
  const webmCandidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return {
    mp4: mp4Candidates.some((m) => MediaRecorder.isTypeSupported(m)),
    webm: webmCandidates.some((m) => MediaRecorder.isTypeSupported(m)),
  };
}

/** Pick the best video MIME type supported by the current browser, preferring MP4. */
function getBestMimeType(preferred: ExportFormat = 'mp4'): {
  mimeType: string;
  extension: string;
} {
  const mp4Candidates = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4;codecs=h264,aac', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
  ];
  const webmCandidates = [
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];

  const ordered =
    preferred === 'webm'
      ? [...webmCandidates, ...mp4Candidates]
      : [...mp4Candidates, ...webmCandidates];

  for (const c of ordered) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(c.mimeType)
    ) {
      return c;
    }
  }
  return { mimeType: '', extension: 'webm' };
}

/** Draw an image or video onto a canvas with object-fit: contain and optional crop insets. */
function drawContain(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLVideoElement,
  canvasW: number,
  canvasH: number,
  opacity: number,
  crop?: { top?: number; right?: number; bottom?: number; left?: number }
) {
  const srcW =
    source instanceof HTMLVideoElement ? source.videoWidth : source.naturalWidth;
  const srcH =
    source instanceof HTMLVideoElement ? source.videoHeight : source.naturalHeight;
  if (!srcW || !srcH) return;

  const scale = Math.min(canvasW / srcW, canvasH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const dx = (canvasW - drawW) / 2;
  const dy = (canvasH - drawH) / 2;

  ctx.save();
  if (crop) {
    const t = ((crop.top ?? 0) / 100) * canvasH;
    const r = ((crop.right ?? 0) / 100) * canvasW;
    const b = ((crop.bottom ?? 0) / 100) * canvasH;
    const l = ((crop.left ?? 0) / 100) * canvasW;
    if (t > 0 || r > 0 || b > 0 || l > 0) {
      ctx.beginPath();
      ctx.rect(l, t, Math.max(0, canvasW - l - r), Math.max(0, canvasH - t - b));
      ctx.clip();
    }
  }
  ctx.globalAlpha = Math.max(0, Math.min(1, opacity));
  ctx.drawImage(source, dx, dy, drawW, drawH);
  ctx.restore();
}

/** Draw a styled subtitle caption onto the export canvas. */
function drawSubtitle(
  ctx: CanvasRenderingContext2D,
  clip: TimelineClip,
  canvasW: number,
  canvasH: number
) {
  const rawText = (clip.text ?? clip.label ?? '').trim();
  if (!rawText) return;

  // Scale font size relative to 720p baseline so 720p and 1080p look consistent
  const scaleFactor = canvasH / 540;
  const fontSize = Math.round((clip.fontSize ?? 32) * scaleFactor);
  const lineHeight = Math.round(fontSize * 1.3);
  const padX = Math.round(fontSize * 0.65);
  const padY = Math.round(fontSize * 0.3);
  const maxWidth = canvasW * 0.84;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, clip.opacity));
  ctx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Wrap text by explicit newlines and maxWidth
  const lines: string[] = [];
  for (const paragraph of rawText.split('\n')) {
    const words = paragraph.split(' ');
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  }
  if (lines.length === 0) {
    ctx.restore();
    return;
  }

  const maxLineW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const boxW = maxLineW + padX * 2;
  const boxH = lines.length * lineHeight + padY * 2;

  const centerX = ((clip.textX ?? 50) / 100) * canvasW;
  let centerY: number;
  if (clip.textY !== undefined) {
    centerY = (clip.textY / 100) * canvasH;
  } else {
    const pos = clip.textPosition ?? 'bottom';
    centerY =
      pos === 'top'
        ? canvasH * 0.14
        : pos === 'center'
        ? canvasH * 0.5
        : canvasH * 0.86;
  }

  const boxX = Math.max(8, Math.min(canvasW - boxW - 8, centerX - boxW / 2));
  const boxY = Math.max(8, Math.min(canvasH - boxH - 8, centerY - boxH / 2));

  // Semi-transparent rounded background box
  const bgHex = (clip.textBgColor ?? '#000000').replace('#', '');
  const r = bgHex.length === 6 ? parseInt(bgHex.slice(0, 2), 16) : 0;
  const g = bgHex.length === 6 ? parseInt(bgHex.slice(2, 4), 16) : 0;
  const b = bgHex.length === 6 ? parseInt(bgHex.slice(4, 6), 16) : 0;

  ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.72)`;
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxW, boxH, Math.round(fontSize * 0.25));
  ctx.fill();

  // Draw text lines
  ctx.fillStyle = clip.textColor ?? '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  const textCenterX = boxX + boxW / 2;
  lines.forEach((line, i) => {
    const y = boxY + padY + lineHeight * (i + 0.5);
    ctx.fillText(line, textCenterX, y);
  });

  ctx.restore();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for export'));
    img.src = url;
  });
}

function loadMediaElement<T extends HTMLVideoElement | HTMLAudioElement>(
  tag: 'video' | 'audio',
  url: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const el = document.createElement(tag) as T;
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    if (el instanceof HTMLVideoElement) {
      el.playsInline = true;
    }
    el.onloadeddata = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${tag} for export`));
    el.src = url;
    el.load();
  });
}

/**
 * Renders the timeline in real-time onto an offscreen canvas + Web Audio destination
 * and encodes a downloadable video using MediaRecorder.
 */
export async function exportTimelineVideo(
  tracks: Track[],
  clips: TimelineClip[],
  mediaItems: MediaItem[],
  options: ExportOptions
): Promise<ExportResult> {
  const {
    width,
    height,
    fps,
    filename,
    format = 'mp4',
    startTime: optStart = 0,
    endTime: optEnd,
    onProgress,
    signal,
  } = options;

  const trackIds = new Set(tracks.map((t) => t.id));
  const trackMutedMap = new Map(tracks.map((t) => [t.id, t.muted]));
  const trackOrderMap = new Map<string, number>();
  tracks.forEach((t, index) => {
    const priority =
      t.type === 'text'
        ? 200 + index
        : t.type === 'image' || t.type === 'overlay'
        ? 100 + index
        : index;
    trackOrderMap.set(t.id, priority);
  });

  const activeableClips = clips.filter(
    (c) => trackIds.has(c.trackId) && !trackMutedMap.get(c.trackId)
  );
  if (activeableClips.length === 0) {
    throw new Error('No unmuted clips on the timeline to export.');
  }

  const maxClipEnd = Math.max(
    ...activeableClips.map((c) => c.startTime + c.duration)
  );
  const rangeStart = Math.max(0, optStart);
  const rangeEnd =
    optEnd !== undefined && optEnd > rangeStart ? optEnd : maxClipEnd;
  const totalDuration = rangeEnd - rangeStart;
  if (totalDuration <= 0) {
    throw new Error('Export duration must be greater than zero.');
  }

  const mediaMap = new Map(mediaItems.map((m) => [m.id, m]));

  // 1. Setup offscreen canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not initialize 2D canvas context.');

  // 2. Setup Web Audio API for mixing video/audio clips
  const audioCtx = new AudioContext();
  const audioDest = audioCtx.createMediaStreamDestination();

  // 3. Preload all clip assets (one element per clip so overlapping clips don't conflict)
  interface PreparedClip {
    clip: TimelineClip;
    order: number;
    img?: HTMLImageElement;
    video?: HTMLVideoElement;
    audio?: HTMLAudioElement;
    gainNode?: GainNode;
    isPlaying: boolean;
  }

  const prepared: PreparedClip[] = [];

  for (const clip of activeableClips) {
    const order = trackOrderMap.get(clip.trackId) ?? 0;

    if (clip.mediaType === 'text') {
      // Subtitles render on top of all video/image tracks
      prepared.push({ clip, order: order + 1000, isPlaying: false });
      continue;
    }

    const media = mediaMap.get(clip.mediaId);
    if (!media) continue;

    if (clip.mediaType === 'image') {
      const img = await loadImage(media.url);
      prepared.push({ clip, order, img, isPlaying: false });
    } else if (clip.mediaType === 'video') {
      const video = await loadMediaElement<HTMLVideoElement>('video', media.url);
      video.currentTime = clip.trimStart;
      // Route video audio into Web Audio destination
      let gainNode: GainNode | undefined;
      try {
        const src = audioCtx.createMediaElementSource(video);
        gainNode = audioCtx.createGain();
        gainNode.gain.value = clip.volume;
        src.connect(gainNode);
        gainNode.connect(audioDest);
      } catch {
        video.muted = true;
      }
      prepared.push({ clip, order, video, gainNode, isPlaying: false });
    } else if (clip.mediaType === 'audio') {
      const audio = await loadMediaElement<HTMLAudioElement>('audio', media.url);
      audio.currentTime = clip.trimStart;
      let gainNode: GainNode | undefined;
      try {
        const src = audioCtx.createMediaElementSource(audio);
        gainNode = audioCtx.createGain();
        gainNode.gain.value = clip.volume;
        src.connect(gainNode);
        gainNode.connect(audioDest);
      } catch {
        audio.muted = true;
      }
      prepared.push({ clip, order, audio, gainNode, isPlaying: false });
    }
  }

  prepared.sort((a, b) => a.order - b.order);

  // 4. Combine canvas video stream + audio stream
  const canvasStream = canvas.captureStream(fps);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...audioDest.stream.getAudioTracks(),
  ]);

  const { mimeType, extension } = getBestMimeType(format);
  const recorderOptions: MediaRecorderOptions = mimeType
    ? { mimeType, videoBitsPerSecond: 5_000_000 }
    : { videoBitsPerSecond: 5_000_000 };

  const recorder = new MediaRecorder(combinedStream, recorderOptions);
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const cleanup = () => {
    for (const p of prepared) {
      if (p.video) {
        p.video.pause();
        p.video.src = '';
      }
      if (p.audio) {
        p.audio.pause();
        p.audio.src = '';
      }
    }
    if (audioCtx.state !== 'closed') {
      void audioCtx.close();
    }
  };

  return new Promise<ExportResult>((resolve, reject) => {
    let rafId = 0;
    let cancelled = false;

    const handleAbort = () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (recorder.state !== 'inactive') {
        recorder.stop();
      }
      cleanup();
      reject(new Error('Export cancelled.'));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }
      signal.addEventListener('abort', handleAbort, { once: true });
    }

    recorder.onstop = () => {
      if (signal) signal.removeEventListener('abort', handleAbort);
      cleanup();
      if (cancelled) return;

      const blob = new Blob(chunks, { type: mimeType || 'video/webm' });
      const url = URL.createObjectURL(blob);
      const safeName = filename.replace(/\.[^.]+$/, '') || 'timeline-export';
      resolve({
        blob,
        url,
        extension,
        filename: `${safeName}.${extension}`,
        sizeBytes: blob.size,
      });
    };

    recorder.onerror = () => {
      if (signal) signal.removeEventListener('abort', handleAbort);
      cancelAnimationFrame(rafId);
      cleanup();
      reject(new Error('MediaRecorder encountered an error while exporting.'));
    };

    // Start recording & real-time render loop
    recorder.start(200);
    const startWallTime = performance.now();

    const renderFrame = () => {
      if (cancelled) return;
      const elapsedSec = (performance.now() - startWallTime) / 1000;
      const timelineSec = rangeStart + elapsedSec;

      // Clear background
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      for (const item of prepared) {
        const { clip } = item;
        const isActive =
          timelineSec >= clip.startTime &&
          timelineSec < clip.startTime + clip.duration;

        if (isActive) {
          const mediaTime = Math.max(0, timelineSec - clip.startTime + clip.trimStart);

          const crop = {
            top: clip.cropTop,
            right: clip.cropRight,
            bottom: clip.cropBottom,
            left: clip.cropLeft,
          };

          if (clip.mediaType === 'text') {
            drawSubtitle(ctx, clip, width, height);
          } else if (item.img) {
            drawContain(ctx, item.img, width, height, clip.opacity, crop);
          } else if (item.video) {
            if (!item.isPlaying) {
              item.video.currentTime = mediaTime;
              item.video.play().catch(() => {});
              item.isPlaying = true;
            } else if (Math.abs(item.video.currentTime - mediaTime) > 0.3) {
              item.video.currentTime = mediaTime;
            }
            drawContain(ctx, item.video, width, height, clip.opacity, crop);
          } else if (item.audio) {
            if (!item.isPlaying) {
              item.audio.currentTime = mediaTime;
              item.audio.play().catch(() => {});
              item.isPlaying = true;
            } else if (Math.abs(item.audio.currentTime - mediaTime) > 0.3) {
              item.audio.currentTime = mediaTime;
            }
          }
        } else {
          if (item.video && item.isPlaying) {
            item.video.pause();
            item.isPlaying = false;
          }
          if (item.audio && item.isPlaying) {
            item.audio.pause();
            item.isPlaying = false;
          }
        }
      }

      const pct = Math.min(100, (elapsedSec / totalDuration) * 100);
      onProgress?.(pct, Math.min(elapsedSec, totalDuration), totalDuration);

      if (elapsedSec >= totalDuration) {
        onProgress?.(100, totalDuration, totalDuration);
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
        return;
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
  });
}

/** Trigger browser file download for a Blob URL. */
export function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
