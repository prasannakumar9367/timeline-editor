import React, { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { MediaType } from '../../types/editor';
import { formatTime } from '../../utils/time';
import { getTextCoords } from '../Preview/Preview';
import { MediaTypeIcon, CopyIcon, TrashIcon, CropIcon } from '../Icons/Icons';
import './PropertiesPanel.css';

/**
 * Media type badge metadata
 */
const MEDIA_TYPE_CONFIG: Record<MediaType, { label: string; className: string }> = {
  video: {
    label: 'Video',
    className: 'props-badge-video',
  },
  audio: {
    label: 'Audio',
    className: 'props-badge-audio',
  },
  image: {
    label: 'Image',
    className: 'props-badge-image',
  },
  text: {
    label: 'Subtitle',
    className: 'props-badge-text',
  },
};

/**
 * PropertiesPanel Component
 * Displays editable properties for the currently selected clip on the timeline.
 */
const PropertiesPanel: React.FC = () => {
  const selectedClipId = useEditorStore((state) => state.selectedClipId);
  const clips = useEditorStore((state) => state.clips);
  const mediaItems = useEditorStore((state) => state.mediaItems);
  const updateClip = useEditorStore((state) => state.updateClip);
  const deleteClip = useEditorStore((state) => state.deleteClip);
  const duplicateClip = useEditorStore((state) => state.duplicateClip);
  const recordHistory = useEditorStore((state) => state.recordHistory);
  const isCropMode = useEditorStore((state) => state.isCropMode);
  const toggleCropMode = useEditorStore((state) => state.toggleCropMode);

  // Track whether we already recorded an undo snapshot for the current input focus session
  const inputHistoryRecordedRef = useRef(false);
  const ensureInputHistory = () => {
    if (!inputHistoryRecordedRef.current) {
      recordHistory();
      inputHistoryRecordedRef.current = true;
    }
  };
  const resetInputHistory = () => {
    inputHistoryRecordedRef.current = false;
  };

  const selectedClip = clips.find((c) => c.id === selectedClipId);
  const mediaItem = selectedClip
    ? mediaItems.find((m) => m.id === selectedClip.mediaId)
    : undefined;

  // Local state for smooth numeric input editing without cursor jumps
  const [startTimeInput, setStartTimeInput] = useState<string>('');
  const [durationInput, setDurationInput] = useState<string>('');

  useEffect(() => {
    if (selectedClip) {
      setStartTimeInput(String(Number(selectedClip.startTime.toFixed(2))));
      setDurationInput(String(Number(selectedClip.duration.toFixed(2))));
    }
  }, [selectedClip?.id, selectedClip?.startTime, selectedClip?.duration]);

  // Handle Start Time changes
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setStartTimeInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed >= 0 && selectedClip) {
      ensureInputHistory();
      updateClip(selectedClip.id, { startTime: parsed }, { recordHistory: false });
    }
  };

  const handleStartTimeBlur = () => {
    resetInputHistory();
    if (!selectedClip) return;
    const parsed = parseFloat(startTimeInput);
    if (isNaN(parsed) || parsed < 0) {
      setStartTimeInput(String(Number(selectedClip.startTime.toFixed(2))));
    } else {
      setStartTimeInput(String(Number(parsed.toFixed(2))));
    }
  };

  // Handle Duration changes
  const handleDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setDurationInput(valStr);
    const parsed = parseFloat(valStr);
    if (!isNaN(parsed) && parsed > 0 && selectedClip) {
      ensureInputHistory();
      updateClip(selectedClip.id, { duration: Math.max(0.1, parsed) }, { recordHistory: false });
    }
  };

  const handleDurationBlur = () => {
    resetInputHistory();
    if (!selectedClip) return;
    const parsed = parseFloat(durationInput);
    if (isNaN(parsed) || parsed <= 0) {
      setDurationInput(String(Number(selectedClip.duration.toFixed(2))));
    } else {
      setDurationInput(String(Number(Math.max(0.1, parsed).toFixed(2))));
    }
  };

  // When NO clip is selected, render header with placeholder message
  if (!selectedClip) {
    return (
      <aside className="props-panel" aria-label="Properties Panel">
        <div className="props-header">
          <h2 className="props-header-title">Properties</h2>
        </div>
        <div className="props-empty">
          <div className="props-empty-icon" aria-hidden="true">
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
              <line x1="7" y1="2" x2="7" y2="22" />
              <line x1="17" y1="2" x2="17" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="2" y1="7" x2="7" y2="7" />
              <line x1="2" y1="17" x2="7" y2="17" />
              <line x1="17" y1="17" x2="22" y2="17" />
              <line x1="17" y1="7" x2="22" y2="7" />
            </svg>
          </div>
          <p className="props-empty-text">Select a clip to view properties</p>
          <p className="props-empty-subtext">
            Click on any timeline clip to inspect and adjust its parameters.
          </p>
        </div>
      </aside>
    );
  }

  const mediaTypeInfo = MEDIA_TYPE_CONFIG[selectedClip.mediaType] ?? {
    label: selectedClip.mediaType,
    className: '',
  };

  const isAudioOrVideo =
    selectedClip.mediaType === 'audio' || selectedClip.mediaType === 'video';
  const isVideoOrImage =
    selectedClip.mediaType === 'video' ||
    selectedClip.mediaType === 'image' ||
    selectedClip.mediaType === 'text';
  const isCroppable =
    selectedClip.mediaType === 'video' || selectedClip.mediaType === 'image';
  const isTextClip = selectedClip.mediaType === 'text';

  const cropTop = selectedClip.cropTop ?? 0;
  const cropRight = selectedClip.cropRight ?? 0;
  const cropBottom = selectedClip.cropBottom ?? 0;
  const cropLeft = selectedClip.cropLeft ?? 0;
  const hasCrop = cropTop > 0 || cropRight > 0 || cropBottom > 0 || cropLeft > 0;

  const volumePercent = Math.round((selectedClip.volume ?? 1) * 100);
  const opacityPercent = Math.round((selectedClip.opacity ?? 1) * 100);
  const thumbnailPreview = selectedClip.thumbnail || mediaItem?.thumbnail;

  return (
    <aside className="props-panel" aria-label="Properties Panel">
      <div className="props-header">
        <h2 className="props-header-title">Properties</h2>
      </div>

      <div className="props-body">
        {/* ── 0. Subtitle Text Section (for Text / Subtitle clips) ── */}
        {isTextClip && (
          <section className="props-section">
            <h3 className="props-section-header">Subtitle Text</h3>

            <div className="props-field">
              <label className="props-field-label" htmlFor="props-subtitle-text">
                Caption
              </label>
              <textarea
                id="props-subtitle-text"
                className="props-textarea"
                rows={3}
                value={selectedClip.text ?? ''}
                placeholder="Type your subtitle text..."
                onFocus={resetInputHistory}
                onBlur={resetInputHistory}
                onChange={(e) => {
                  const val = e.target.value;
                  ensureInputHistory();
                  updateClip(
                    selectedClip.id,
                    {
                      text: val,
                      label: val.trim().slice(0, 24) || 'Subtitle',
                    },
                    { recordHistory: false }
                  );
                }}
              />
            </div>

            <div className="props-field">
              <div className="props-field-header">
                <label className="props-field-label" htmlFor="props-font-size">
                  Font Size
                </label>
                <span className="props-time-display">
                  {selectedClip.fontSize ?? 32}px
                </span>
              </div>
              <input
                id="props-font-size"
                type="range"
                min={16}
                max={72}
                step={2}
                className="props-slider"
                value={selectedClip.fontSize ?? 32}
                onPointerDown={recordHistory}
                onChange={(e) =>
                  updateClip(
                    selectedClip.id,
                    { fontSize: Number(e.target.value) },
                    { recordHistory: false }
                  )
                }
              />
            </div>

            <div className="props-field">
              <div className="props-field-header">
                <span className="props-field-label">Position</span>
                <span className="props-time-display">
                  {Math.round(getTextCoords(selectedClip).x)}%,{' '}
                  {Math.round(getTextCoords(selectedClip).y)}%
                </span>
              </div>
              <div className="props-pos-group">
                {(
                  [
                    { pos: 'top', y: 14 },
                    { pos: 'center', y: 50 },
                    { pos: 'bottom', y: 86 },
                  ] as const
                ).map(({ pos, y }) => {
                  const coords = getTextCoords(selectedClip);
                  const isPresetActive =
                    Math.abs(coords.x - 50) < 0.5 && Math.abs(coords.y - y) < 0.5;
                  return (
                    <button
                      key={pos}
                      type="button"
                      className={`props-pos-btn ${isPresetActive ? 'active' : ''}`}
                      onClick={() =>
                        updateClip(selectedClip.id, {
                          textPosition: pos,
                          textX: 50,
                          textY: y,
                        })
                      }
                    >
                      {pos[0].toUpperCase() + pos.slice(1)}
                    </button>
                  );
                })}
              </div>
              <span className="props-hint">Drag text directly in the preview to place it anywhere</span>
            </div>

            <div className="props-row">
              <div className="props-field props-col">
                <label className="props-field-label" htmlFor="props-text-color">
                  Text Color
                </label>
                <div className="props-color-picker-wrap">
                  <input
                    id="props-text-color"
                    type="color"
                    className="props-color-input"
                    value={selectedClip.textColor ?? '#ffffff'}
                    onChange={(e) =>
                      updateClip(selectedClip.id, { textColor: e.target.value })
                    }
                  />
                  <span className="props-color-hex">
                    {selectedClip.textColor ?? '#ffffff'}
                  </span>
                </div>
              </div>

              <div className="props-field props-col">
                <label className="props-field-label" htmlFor="props-bg-color">
                  Background
                </label>
                <div className="props-color-picker-wrap">
                  <input
                    id="props-bg-color"
                    type="color"
                    className="props-color-input"
                    value={selectedClip.textBgColor ?? '#000000'}
                    onChange={(e) =>
                      updateClip(selectedClip.id, { textBgColor: e.target.value })
                    }
                  />
                  <span className="props-color-hex">
                    {selectedClip.textBgColor ?? '#000000'}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── 1. Clip Info Section ── */}
        <section className="props-section">
          <h3 className="props-section-header">Clip Info</h3>

          <div className="props-field">
            <label className="props-field-label" htmlFor="props-clip-label">
              Label
            </label>
            <input
              id="props-clip-label"
              type="text"
              className="props-input"
              value={selectedClip.label}
              placeholder="Clip label"
              onFocus={resetInputHistory}
              onBlur={resetInputHistory}
              onChange={(e) => {
                ensureInputHistory();
                updateClip(selectedClip.id, { label: e.target.value }, { recordHistory: false });
              }}
            />
          </div>

          <div className="props-row">
            <div className="props-field props-col">
              <span className="props-field-label">Media Type</span>
              <div className={`props-badge ${mediaTypeInfo.className}`}>
                <span className="props-badge-icon">
                  <MediaTypeIcon type={selectedClip.mediaType} size={13} />
                </span>
                <span className="props-badge-text">{mediaTypeInfo.label}</span>
              </div>
            </div>

            <div className="props-field props-col">
              <label className="props-field-label" htmlFor="props-clip-color">
                Color
              </label>
              <div className="props-color-picker-wrap">
                <input
                  id="props-clip-color"
                  type="color"
                  className="props-color-input"
                  value={selectedClip.color}
                  onChange={(e) =>
                    updateClip(selectedClip.id, { color: e.target.value })
                  }
                  title="Change clip color"
                />
                <span className="props-color-hex">{selectedClip.color}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 2. Timing Section ── */}
        <section className="props-section">
          <h3 className="props-section-header">Timing</h3>

          <div className="props-field">
            <div className="props-field-header">
              <label className="props-field-label" htmlFor="props-start-time">
                Start Time
              </label>
              <span className="props-time-display">
                {formatTime(selectedClip.startTime)}
              </span>
            </div>
            <div className="props-input-unit-wrap">
              <input
                id="props-start-time"
                type="number"
                step="0.1"
                min="0"
                className="props-input"
                value={startTimeInput}
                onChange={handleStartTimeChange}
                onBlur={handleStartTimeBlur}
              />
              <span className="props-unit-tag">s</span>
            </div>
          </div>

          <div className="props-field">
            <div className="props-field-header">
              <label className="props-field-label" htmlFor="props-duration">
                Duration
              </label>
              <span className="props-time-display">
                {formatTime(selectedClip.duration)}
              </span>
            </div>
            <div className="props-input-unit-wrap">
              <input
                id="props-duration"
                type="number"
                step="0.1"
                min="0.1"
                className="props-input"
                value={durationInput}
                onChange={handleDurationChange}
                onBlur={handleDurationBlur}
              />
              <span className="props-unit-tag">s</span>
            </div>
          </div>

          <div className="props-field">
            <div className="props-field-header">
              <span className="props-field-label">Trim Start</span>
              <span className="props-time-display">
                {formatTime(selectedClip.trimStart)}
              </span>
            </div>
            <div className="props-readonly-display" title="Trim start offset into source media">
              <span>{selectedClip.trimStart.toFixed(1)}s</span>
              <span className="props-readonly-tag">Read-only</span>
            </div>
          </div>
        </section>

        {/* ── 3. Properties Section (Volume & Opacity) ── */}
        {(isAudioOrVideo || isVideoOrImage) && (
          <section className="props-section">
            <h3 className="props-section-header">Properties</h3>

            {/* Volume: for audio/video clips */}
            {isAudioOrVideo && (
              <div className="props-field">
                <div className="props-field-header">
                  <label className="props-field-label" htmlFor="props-volume">
                    Volume
                  </label>
                  <span className="props-range-value">{volumePercent}%</span>
                </div>
                <input
                  id="props-volume"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="props-range-slider"
                  value={volumePercent}
                  onPointerDown={recordHistory}
                  onChange={(e) =>
                    updateClip(
                      selectedClip.id,
                      { volume: Number(e.target.value) / 100 },
                      { recordHistory: false }
                    )
                  }
                />
              </div>
            )}

            {/* Opacity: for video/image clips */}
            {isVideoOrImage && (
              <div className="props-field">
                <div className="props-field-header">
                  <label className="props-field-label" htmlFor="props-opacity">
                    Opacity
                  </label>
                  <span className="props-range-value">{opacityPercent}%</span>
                </div>
                <input
                  id="props-opacity"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  className="props-range-slider"
                  value={opacityPercent}
                  onPointerDown={recordHistory}
                  onChange={(e) =>
                    updateClip(
                      selectedClip.id,
                      { opacity: Number(e.target.value) / 100 },
                      { recordHistory: false }
                    )
                  }
                />
              </div>
            )}
          </section>
        )}

        {/* ── 3b. Crop Section (Video & Image clips) ── */}
        {isCroppable && (
          <section className="props-section">
            <h3 className="props-section-header">Crop</h3>

            <div className="props-actions-group">
              <button
                type="button"
                className={`props-btn props-btn-crop ${isCropMode ? 'active' : ''}`}
                onClick={toggleCropMode}
                title="Toggle interactive crop handles in preview"
              >
                <CropIcon size={13} />
                <span>{isCropMode ? 'Done Cropping' : 'Crop in Preview'}</span>
              </button>
              <button
                type="button"
                className="props-btn props-btn-duplicate"
                disabled={!hasCrop}
                onClick={() =>
                  updateClip(selectedClip.id, {
                    cropTop: 0,
                    cropRight: 0,
                    cropBottom: 0,
                    cropLeft: 0,
                  })
                }
                title="Reset crop to full frame"
              >
                Reset
              </button>
            </div>

            <div className="props-crop-grid">
              {(
                [
                  { label: 'Top', key: 'cropTop', value: cropTop, max: Math.max(0, 90 - cropBottom) },
                  { label: 'Bottom', key: 'cropBottom', value: cropBottom, max: Math.max(0, 90 - cropTop) },
                  { label: 'Left', key: 'cropLeft', value: cropLeft, max: Math.max(0, 90 - cropRight) },
                  { label: 'Right', key: 'cropRight', value: cropRight, max: Math.max(0, 90 - cropLeft) },
                ] as const
              ).map(({ label, key, value, max }) => (
                <div key={key} className="props-field">
                  <div className="props-field-header">
                    <label className="props-field-label" htmlFor={`props-${key}`}>
                      {label}
                    </label>
                    <span className="props-range-value">{Math.round(value)}%</span>
                  </div>
                  <input
                    id={`props-${key}`}
                    type="range"
                    min={0}
                    max={Math.min(45, Math.round(max))}
                    step={1}
                    className="props-range-slider"
                    value={Math.round(value)}
                    onPointerDown={recordHistory}
                    onChange={(e) =>
                      updateClip(
                        selectedClip.id,
                        { [key]: Number(e.target.value) },
                        { recordHistory: false }
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 4. Actions Section ── */}
        <section className="props-section">
          <h3 className="props-section-header">Actions</h3>
          <div className="props-actions-group">
            <button
              type="button"
              className="props-btn props-btn-duplicate"
              onClick={() => duplicateClip(selectedClip.id)}
              title="Duplicate selected clip"
            >
              <CopyIcon size={13} />
              <span>Duplicate</span>
            </button>
            <button
              type="button"
              className="props-btn props-btn-delete"
              onClick={() => deleteClip(selectedClip.id)}
              title="Delete selected clip"
            >
              <TrashIcon size={13} />
              <span>Delete</span>
            </button>
          </div>
        </section>

        {/* ── 5. Media Info Section ── */}
        <section className="props-section">
          <h3 className="props-section-header">Media Info</h3>

          <div className="props-info-card">
            <div className="props-info-row">
              <span className="props-info-label">Source File</span>
              <span
                className="props-info-val props-info-filename"
                title={mediaItem?.name ?? 'Unknown source'}
              >
                {mediaItem?.name ?? 'Unknown source'}
              </span>
            </div>

            <div className="props-info-row">
              <span className="props-info-label">Original Duration</span>
              <span className="props-info-val">
                {mediaItem
                  ? `${formatTime(mediaItem.duration)} (${mediaItem.duration.toFixed(1)}s)`
                  : 'N/A'}
              </span>
            </div>

            <div className="props-thumbnail-section">
              <span className="props-info-label">Thumbnail Preview</span>
              <div className="props-thumbnail-wrap">
                {thumbnailPreview ? (
                  <img
                    src={thumbnailPreview}
                    alt={selectedClip.label || 'Clip thumbnail preview'}
                    className="props-thumbnail-img"
                  />
                ) : (
                  <div className="props-thumbnail-fallback">
                    <span className="props-thumbnail-fallback-icon">
                      <MediaTypeIcon type={selectedClip.mediaType} size={22} />
                    </span>
                    <span className="props-thumbnail-fallback-text">
                      No thumbnail
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};

export default PropertiesPanel;
