import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import {
  exportTimelineVideo,
  getSupportedExportFormats,
  triggerDownload,
} from '../../utils/exporter';
import type { ExportFormat, ExportResult } from '../../utils/exporter';
import { formatTime } from '../../utils/time';
import { DownloadIcon, CloseIcon, CheckIcon } from '../Icons/Icons';
import './ExportModal.css';

const RESOLUTIONS = [
  { label: '720p HD (1280×720)', width: 1280, height: 720 },
  { label: '1080p Full HD (1920×1080)', width: 1920, height: 1080 },
] as const;

export default function ExportModal(): React.JSX.Element | null {
  const isOpen = useEditorStore((s) => s.isExportModalOpen);
  const closeExportModal = useEditorStore((s) => s.closeExportModal);
  const tracks = useEditorStore((s) => s.tracks);
  const clips = useEditorStore((s) => s.clips);
  const mediaItems = useEditorStore((s) => s.mediaItems);

  const supported = useMemo(() => getSupportedExportFormats(), []);
  const [filename, setFilename] = useState('my-video-edit');
  const [format, setFormat] = useState<ExportFormat>(supported.mp4 ? 'mp4' : 'webm');
  const [resIdx, setResIdx] = useState(0);
  const [fps, setFps] = useState(30);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [renderedTime, setRenderedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const { maxClipEnd, longestClipInfo } = useMemo(() => {
    const trackMap = new Map(tracks.map((t) => [t.id, t]));
    const active = clips.filter((c) => {
      const tr = trackMap.get(c.trackId);
      return tr && !tr.muted;
    });
    if (active.length === 0) {
      return { maxClipEnd: 0, longestClipInfo: null as string | null };
    }
    let furthest = active[0];
    for (const c of active) {
      if (c.startTime + c.duration > furthest.startTime + furthest.duration) {
        furthest = c;
      }
    }
    const end = furthest.startTime + furthest.duration;
    const trackName = trackMap.get(furthest.trackId)?.name ?? 'Track';
    return {
      maxClipEnd: Number(end.toFixed(2)),
      longestClipInfo: `"${furthest.label}" on ${trackName} ends at ${end.toFixed(1)}s`,
    };
  }, [tracks, clips]);

  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(0);

  // Sync default range whenever modal opens or clips change
  useEffect(() => {
    if (isOpen) {
      setRangeStart(0);
      setRangeEnd(maxClipEnd);
    }
  }, [isOpen, maxClipEnd]);

  const exportDuration = Math.max(0, Number((rangeEnd - rangeStart).toFixed(2)));

  if (!isOpen) return null;

  const handleClose = () => {
    if (isExporting && abortRef.current) {
      abortRef.current.abort();
    }
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
    setError(null);
    setProgress(0);
    setRenderedTime(0);
    setIsExporting(false);
    closeExportModal();
  };

  const handleStartExport = async () => {
    if (exportDuration <= 0) {
      setError('Add at least one unmuted clip to the timeline before exporting.');
      return;
    }

    setError(null);
    setResult(null);
    setProgress(0);
    setRenderedTime(0);
    setIsExporting(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const res = RESOLUTIONS[resIdx];
    try {
      const resData = await exportTimelineVideo(tracks, clips, mediaItems, {
        width: res.width,
        height: res.height,
        fps,
        format,
        startTime: rangeStart,
        endTime: rangeEnd,
        filename: filename.trim() || 'my-video-edit',
        signal: controller.signal,
        onProgress: (pct, curTime) => {
          setProgress(pct);
          setRenderedTime(curTime);
        },
      });
      setResult(resData);
      triggerDownload(resData.url, resData.filename);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      if (msg !== 'Export cancelled.') {
        setError(msg);
      }
    } finally {
      setIsExporting(false);
      abortRef.current = null;
    }
  };

  const handleCancelExport = () => {
    abortRef.current?.abort();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="export-modal-backdrop" onClick={handleClose}>
      <div
        className="export-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="export-modal-header">
          <h2 id="export-modal-title" className="export-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DownloadIcon size={16} />
            <span>Export Video</span>
          </h2>
          <button
            type="button"
            className="export-modal-close"
            onClick={handleClose}
            aria-label="Close export modal"
          >
            <CloseIcon size={14} />
          </button>
        </div>

        <div className="export-modal-body">
          {maxClipEnd <= 0 ? (
            <div className="export-modal-empty">
              No active clips on the timeline to export. Upload and place media on a track first.
            </div>
          ) : (
            <>
              <div className="export-row">
                <div className="export-field">
                  <label htmlFor="export-filename" className="export-label">
                    File Name
                  </label>
                  <input
                    id="export-filename"
                    type="text"
                    className="export-input"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    disabled={isExporting}
                    placeholder="my-video-edit"
                  />
                </div>

                <div className="export-field">
                  <label htmlFor="export-format" className="export-label">
                    Format
                  </label>
                  <select
                    id="export-format"
                    className="export-select"
                    value={format}
                    onChange={(e) => setFormat(e.target.value as ExportFormat)}
                    disabled={isExporting}
                  >
                    <option value="mp4" disabled={!supported.mp4}>
                      MP4 (.mp4){supported.mp4 ? ' — Recommended' : ' (Unsupported)'}
                    </option>
                    <option value="webm" disabled={!supported.webm}>
                      WebM (.webm)
                    </option>
                  </select>
                </div>
              </div>

              <div className="export-row">
                <div className="export-field">
                  <label htmlFor="export-resolution" className="export-label">
                    Resolution
                  </label>
                  <select
                    id="export-resolution"
                    className="export-select"
                    value={resIdx}
                    onChange={(e) => setResIdx(Number(e.target.value))}
                    disabled={isExporting}
                  >
                    {RESOLUTIONS.map((r, i) => (
                      <option key={r.label} value={i}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="export-field">
                  <label htmlFor="export-fps" className="export-label">
                    Frame Rate
                  </label>
                  <select
                    id="export-fps"
                    className="export-select"
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    disabled={isExporting}
                  >
                    <option value={30}>30 FPS</option>
                    <option value={60}>60 FPS</option>
                  </select>
                </div>
              </div>

              <div className="export-row">
                <div className="export-field">
                  <label htmlFor="export-range-start" className="export-label">
                    Start (sec)
                  </label>
                  <input
                    id="export-range-start"
                    type="number"
                    min={0}
                    max={Math.max(0, rangeEnd - 0.1)}
                    step={0.1}
                    className="export-input"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(Math.max(0, Number(e.target.value) || 0))}
                    disabled={isExporting}
                  />
                </div>

                <div className="export-field">
                  <label htmlFor="export-range-end" className="export-label">
                    End (sec)
                  </label>
                  <input
                    id="export-range-end"
                    type="number"
                    min={rangeStart + 0.1}
                    step={0.1}
                    className="export-input"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(Math.max(0.1, Number(e.target.value) || 0.1))}
                    disabled={isExporting}
                  />
                </div>
              </div>

              <div className="export-summary">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span>Export Duration:</span>
                  {longestClipInfo && (
                    <span style={{ fontSize: '11px', color: '#777' }}>
                      Furthest clip: {longestClipInfo}
                    </span>
                  )}
                </div>
                <strong>{formatTime(exportDuration)}</strong>
              </div>

              {isExporting && (
                <div className="export-progress-box">
                  <div className="export-progress-meta">
                    <span>Rendering video…</span>
                    <span>
                      {formatTime(renderedTime)} / {formatTime(exportDuration)} ({Math.round(progress)}%)
                    </span>
                  </div>
                  <div className="export-progress-track">
                    <div
                      className="export-progress-fill"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && <div className="export-error">{error}</div>}

              {result && !isExporting && (
                <div className="export-result-block">
                  <video
                    src={result.url}
                    controls
                    className="export-preview-video"
                  />
                  <div className="export-success">
                    <div className="export-success-info">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <CheckIcon size={14} />
                        <span>Export complete: <strong>{result.filename}</strong></span>
                      </span>
                      <span className="export-success-size">{formatSize(result.sizeBytes)}</span>
                    </div>
                    <button
                      type="button"
                      className="export-btn export-btn-secondary"
                      onClick={() => triggerDownload(result.url, result.filename)}
                    >
                      Download Again
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="export-modal-footer">
          {isExporting ? (
            <button
              type="button"
              className="export-btn export-btn-danger"
              onClick={handleCancelExport}
            >
              Cancel Export
            </button>
          ) : (
            <>
              <button
                type="button"
                className="export-btn export-btn-secondary"
                onClick={handleClose}
              >
                Close
              </button>
              <button
                type="button"
                className="export-btn export-btn-primary"
                onClick={handleStartExport}
                disabled={exportDuration <= 0}
              >
                Start Export
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
