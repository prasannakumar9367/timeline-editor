import React, { useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../../types/editor';
import { extractAudioWaveform } from '../../utils/media';

interface AudioWaveformProps {
  media?: MediaItem;
  trimStart: number;
  duration: number;
  widthPx: number;
  color: string;
  volume: number;
}

const waveformCache = new Map<string, number[]>();
const MAX_BACKING_WIDTH = 8192;
const CLIP_HEIGHT = 44;

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  media,
  trimStart,
  duration,
  widthPx,
  color,
  volume,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [peaks, setPeaks] = useState<number[]>(() => {
    if (media?.waveform && media.waveform.length > 0) return media.waveform;
    if (media?.id && waveformCache.has(media.id)) return waveformCache.get(media.id)!;
    return [];
  });

  // Lazily decode waveform for audio items loaded from storage without cached peaks
  useEffect(() => {
    if (!media) return;
    if (media.waveform && media.waveform.length > 0) {
      waveformCache.set(media.id, media.waveform);
      setPeaks(media.waveform);
      return;
    }
    const cached = waveformCache.get(media.id);
    if (cached && cached.length > 0) {
      setPeaks(cached);
      return;
    }
    if (!media.file) return;

    let cancelled = false;
    void extractAudioWaveform(media.file).then((extracted) => {
      if (cancelled || extracted.length === 0) return;
      waveformCache.set(media.id, extracted);
      setPeaks(extracted);
    });

    return () => {
      cancelled = true;
    };
  }, [media]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const drawWidth = Math.max(12, Math.min(Math.ceil(widthPx), Math.floor(MAX_BACKING_WIDTH / dpr)));
    const drawHeight = CLIP_HEIGHT;

    canvas.width = Math.max(1, Math.floor(drawWidth * dpr));
    canvas.height = Math.max(1, Math.floor(drawHeight * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, drawWidth, drawHeight);

    const midY = drawHeight / 2;

    // Subtle center baseline
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.fillRect(0, midY - 0.5, drawWidth, 1);

    const barWidth = 2;
    const barGap = 1.5;
    const step = barWidth + barGap;
    const barCount = Math.max(1, Math.floor(drawWidth / step));

    const totalMediaDuration = media && media.duration > 0 ? media.duration : Math.max(duration, 1);
    const startRatio = Math.max(0, Math.min(1, trimStart / totalMediaDuration));
    const endRatio = Math.max(startRatio, Math.min(1, (trimStart + duration) / totalMediaDuration));

    const volScale = Math.max(0.12, Math.min(1, volume));
    const maxHalfHeight = drawHeight * 0.44;

    // Create subtle vertical gradient for wave bars
    const grad = ctx.createLinearGradient(0, 2, 0, drawHeight - 2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;

    for (let i = 0; i < barCount; i++) {
      const ratio = startRatio + ((i + 0.5) / barCount) * (endRatio - startRatio);
      let amp: number;

      if (peaks.length > 0) {
        const idx = Math.min(peaks.length - 1, Math.max(0, Math.floor(ratio * peaks.length)));
        // Sample small neighborhood max so spikes stay crisp when zoomed out
        const nextIdx = Math.min(
          peaks.length - 1,
          Math.max(idx, Math.floor((ratio + (endRatio - startRatio) / barCount) * peaks.length))
        );
        let localPeak = peaks[idx];
        for (let k = idx + 1; k <= nextIdx; k++) {
          if (peaks[k] > localPeak) localPeak = peaks[k];
        }
        amp = localPeak;
      } else {
        // Gentle fallback wave while decoding
        amp = 0.2 + 0.25 * Math.abs(Math.sin(i * 0.45));
      }

      const halfH = Math.max(1.5, amp * volScale * maxHalfHeight);
      const x = i * step;
      const y = midY - halfH;
      const h = halfH * 2;

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, h, 1);
      ctx.fill();
    }
  }, [peaks, media, trimStart, duration, widthPx, color, volume]);

  return <canvas ref={canvasRef} className="timeline-clip-waveform" aria-hidden="true" />;
};
