import { useState, type ChangeEvent } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { TimelineClip } from '../../types/editor';
import { formatTime } from '../../utils/time';
import './Toolbar.css';

export interface ToolbarProps {
  /** Current frames per second reported by the playback clock */
  fps?: number;
  /** Optional active clip reference for toolbar extensions */
  activeClip?: TimelineClip | null;
}

/** Formats zoom multiplier for display (e.g. 1x, 0.25x, 2.5x, 6x) */
const formatZoom = (val: number): string => {
  const rounded = Math.round(val * 100) / 100;
  return `${rounded}x`;
};

export default function Toolbar({ fps = 60 }: ToolbarProps) {
  /* Playback & timeline state */
  const currentTime = useEditorStore((s) => s.currentTime);
  const duration = useEditorStore((s) => s.duration);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const zoom = useEditorStore((s) => s.zoom);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const isSaving = useEditorStore((s) => s.isSaving);
  const clipsCount = useEditorStore((s) => s.clips.length);

  /* Actions */
  const togglePlay = useEditorStore((s) => s.togglePlay);
  const stop = useEditorStore((s) => s.stop);
  const setZoom = useEditorStore((s) => s.setZoom);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const saveProject = useEditorStore((s) => s.saveProject);
  const openExportModal = useEditorStore((s) => s.openExportModal);
  const addSubtitle = useEditorStore((s) => s.addSubtitle);

  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    await saveProject();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  /* Zoom controls */
  const handleZoomOut = () => {
    const next = Math.max(0.25, Math.round((zoom - 0.25) * 100) / 100);
    setZoom(next);
  };

  const handleZoomIn = () => {
    const next = Math.min(6, Math.round((zoom + 0.25) * 100) / 100);
    setZoom(next);
  };

  const handleZoomChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      setZoom(Math.max(0.25, Math.min(6, val)));
    }
  };

  /* FPS status color */
  const roundedFps = Math.max(0, Math.round(fps));
  const fpsCategoryClass =
    roundedFps >= 55
      ? 'toolbar-fps-badge--green toolbar-fps-badge--good'
      : roundedFps >= 30
      ? 'toolbar-fps-badge--yellow toolbar-fps-badge--warning'
      : 'toolbar-fps-badge--red toolbar-fps-badge--bad';

  return (
    <header className="toolbar" role="toolbar" aria-label="Editor Toolbar">
      {/* 1. App Title / Logo Area (Left) */}
      <div className="toolbar-left">
        <div className="toolbar-brand">
          <span className="toolbar-title">🎬 Timeline Editor</span>
        </div>

        <button
          type="button"
          className={`toolbar-btn toolbar-save-btn ${justSaved ? 'toolbar-save-btn--saved' : ''}`}
          onClick={handleSave}
          disabled={isSaving}
          title="Save project & media locally in browser"
        >
          <span>{isSaving ? '⏳ Saving…' : justSaved ? '✓ Saved' : '💾 Save'}</span>
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-subtitle-btn"
          onClick={() => addSubtitle()}
          title="Add a subtitle caption at the current playhead"
        >
          <span>💬 + Subtitle</span>
        </button>
      </div>

      {/* 2. Playback Controls (Center) */}
      <div className="toolbar-center">
        <div className="toolbar-playback">
          <button
            type="button"
            className="toolbar-btn toolbar-btn-stop"
            onClick={stop}
            title="Stop (Reset to start)"
            aria-label="Stop playback"
          >
            <span className="toolbar-btn-icon">⏹</span>
          </button>

          <button
            type="button"
            className={`toolbar-btn toolbar-btn-play ${
              isPlaying ? 'toolbar-btn-play--active' : ''
            }`}
            onClick={togglePlay}
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            <span className="toolbar-btn-icon">{isPlaying ? '⏸' : '▶'}</span>
          </button>
        </div>

        <div className="toolbar-time" title="Current time / Total duration">
          <span className="toolbar-time-current">{formatTime(currentTime)}</span>
          <span className="toolbar-time-separator toolbar-time-divider">/</span>
          <span className="toolbar-time-total toolbar-time-duration">
            {formatTime(duration)}
          </span>
        </div>
      </div>

      {/* 3. Right Side: FPS, Snap Toggle, Zoom Controls */}
      <div className="toolbar-right">
        {/* FPS Counter Badge */}
        <div
          className={`toolbar-fps-badge ${fpsCategoryClass}`}
          title={`Performance: ${roundedFps} FPS`}
          aria-label={`${roundedFps} frames per second`}
        >
          <span className="toolbar-fps-dot" />
          <span className="toolbar-fps-value">{roundedFps}</span>
          <span className="toolbar-fps-label">FPS</span>
        </div>

        {/* Snap Toggle Button */}
        <button
          type="button"
          className={`toolbar-btn toolbar-snap-btn ${
            snapEnabled ? 'toolbar-snap-btn--active' : ''
          }`}
          onClick={toggleSnap}
          title={`Snap to Grid: ${snapEnabled ? 'ON' : 'OFF'}`}
          aria-pressed={snapEnabled}
          aria-label="Toggle snap to grid"
        >
          <span className="toolbar-snap-icon">🧲</span>
          <span className="toolbar-snap-label toolbar-snap-text">Snap</span>
        </button>

        {/* Zoom Slider with +/- buttons */}
        <div
          className="toolbar-zoom-container toolbar-zoom-group"
          title="Timeline Zoom Controls"
        >
          <button
            type="button"
            className="toolbar-btn toolbar-zoom-btn toolbar-zoom-btn--out"
            onClick={handleZoomOut}
            disabled={zoom <= 0.25}
            title="Zoom out (−)"
            aria-label="Zoom out"
          >
            −
          </button>
          <input
            type="range"
            className="toolbar-zoom-slider"
            min={0.25}
            max={6}
            step={0.05}
            value={zoom}
            onChange={handleZoomChange}
            title={`Zoom: ${formatZoom(zoom)}`}
            aria-label="Timeline zoom slider"
          />
          <button
            type="button"
            className="toolbar-btn toolbar-zoom-btn toolbar-zoom-btn--in"
            onClick={handleZoomIn}
            disabled={zoom >= 6}
            title="Zoom in (+)"
            aria-label="Zoom in"
          >
            +
          </button>
          <span
            className="toolbar-zoom-level toolbar-zoom-value"
            data-zoom={zoom}
            title={`Current zoom level: ${formatZoom(zoom)}`}
          >
            {formatZoom(zoom)}
          </span>
        </div>

        {/* Export Video Button */}
        <button
          type="button"
          className="toolbar-btn toolbar-export-btn"
          onClick={openExportModal}
          disabled={clipsCount === 0}
          title={
            clipsCount === 0
              ? 'Add clips to the timeline to export'
              : 'Export timeline as video'
          }
        >
          <span>⬇ Export</span>
        </button>
      </div>
    </header>
  );
}

export { Toolbar };
