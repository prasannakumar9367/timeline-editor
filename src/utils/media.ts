import type { MediaType } from '../types/editor';

/* ─── Detect type from MIME ─── */

export function getMediaType(file: File): MediaType {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('image/')) return 'image';
  // fallback by extension
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogv'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a', 'wma'].includes(ext)) return 'audio';
  return 'image';
}

/* ─── Thumbnail generation ─── */

const THUMB_W = 160;
const THUMB_H = 90;

export function generateThumbnail(file: File, type: MediaType): Promise<string> {
  if (type === 'video') return generateVideoThumbnail(file);
  if (type === 'image') return generateImageThumbnail(file);
  return generateAudioThumbnail();
}

function generateVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    const url = URL.createObjectURL(file);
    video.src = url;

    video.addEventListener('loadeddata', () => {
      // seek to 1 s or 25 % of duration, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.25);
    });

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    });

    video.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(placeholderThumb('🎬'));
    });
  });
}

function generateImageThumbnail(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext('2d')!;

      // cover-fit
      const scale = Math.max(THUMB_W / img.width, THUMB_H / img.height);
      const sw = THUMB_W / scale;
      const sh = THUMB_H / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, THUMB_W, THUMB_H);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(placeholderThumb('🖼️'));
    };
  });
}

function generateAudioThumbnail(): Promise<string> {
  return Promise.resolve(placeholderThumb('🎵'));
}

function placeholderThumb(emoji: string): string {
  const canvas = document.createElement('canvas');
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, THUMB_W, THUMB_H);
  ctx.font = '36px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, THUMB_W / 2, THUMB_H / 2);
  return canvas.toDataURL('image/png');
}

/* ─── Duration ─── */

const DEFAULT_IMAGE_DURATION = 5; // seconds

export function getMediaDuration(file: File, type: MediaType): Promise<number> {
  if (type === 'image') return Promise.resolve(DEFAULT_IMAGE_DURATION);

  return new Promise((resolve) => {
    const el = document.createElement(type === 'video' ? 'video' : 'audio');
    el.preload = 'metadata';
    const url = URL.createObjectURL(file);
    el.src = url;

    el.addEventListener('loadedmetadata', () => {
      const dur = Number.isFinite(el.duration) ? el.duration : 10;
      URL.revokeObjectURL(url);
      resolve(dur);
    });

    el.addEventListener('error', () => {
      URL.revokeObjectURL(url);
      resolve(10);
    });
  });
}

/* ─── Accepted MIME types for the file picker ─── */

export const ACCEPTED_TYPES = [
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska',
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
].join(',');
