import { useState, type ChangeEvent } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { TimelineClip } from '../../types/editor';
import {
  FilmIcon,
  SaveIcon,
  CheckIcon,
  TextIcon,
  UndoIcon,
  RedoIcon,
  MagnetIcon,
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  PlayIcon,
  MicIcon,
  CameraIcon,
} from '../Icons/Icons';
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
  /* Timeline state */
  const zoom = useEditorStore((s) => s.zoom);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const isSaving = useEditorStore((s) => s.isSaving);
  const clipsCount = useEditorStore((s) => s.clips.length);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);

  /* Actions */
  const setZoom = useEditorStore((s) => s.setZoom);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const saveProject = useEditorStore((s) => s.saveProject);
  const loadSavedProject = useEditorStore((s) => s.loadSavedProject);
  const openExportModal = useEditorStore((s) => s.openExportModal);
  const openTtsModal = useEditorStore((s) => s.openTtsModal);
  const openRecordModal = useEditorStore((s) => s.openRecordModal);
  const addSubtitle = useEditorStore((s) => s.addSubtitle);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const selectClip = useEditorStore((s) => s.selectClip);
  const setCropMode = useEditorStore((s) => s.setCropMode);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setFullPreview = useEditorStore((s) => s.setFullPreview);
  const play = useEditorStore((s) => s.play);

  const [justSaved, setJustSaved] = useState(false);

  const handleSave = async () => {
    await saveProject();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handlePreviewSaved = async () => {
    if (clipsCount === 0) {
      const loaded = await loadSavedProject();
      if (!loaded) return;
    }
    setCropMode(false);
    selectClip(null);
    setFullPreview(true);
    setCurrentTime(0);
    play();
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
          <FilmIcon size={17} className="toolbar-brand-icon" />
          <span className="toolbar-title">Timeline Editor</span>
        </div>

        <button
          type="button"
          className={`toolbar-btn toolbar-save-btn ${justSaved ? 'toolbar-save-btn--saved' : ''}`}
          onClick={handleSave}
          disabled={isSaving}
          title="Save project & media locally in browser"
        >
          {justSaved ? <CheckIcon size={14} /> : <SaveIcon size={14} />}
          <span>{isSaving ? 'Saving…' : justSaved ? 'Saved' : 'Save'}</span>
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-subtitle-btn"
          onClick={() => addSubtitle()}
          title="Add a subtitle caption at the current playhead"
        >
          <TextIcon size={14} />
          <span>+ Subtitle</span>
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-tts-btn"
          onClick={openTtsModal}
          title="Generate Text-to-Speech or record microphone voiceover"
        >
          <MicIcon size={14} />
          <span>TTS</span>
        </button>

        <button
          type="button"
          className="toolbar-btn toolbar-record-btn"
          onClick={openRecordModal}
          title="Record live video from camera or screen and upload to timeline"
        >
          <CameraIcon size={14} />
          <span>Record</span>
        </button>

        <div className="toolbar-history-group" role="group" aria-label="Undo and Redo">
          <button
            type="button"
            className="toolbar-btn toolbar-history-btn"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <UndoIcon size={14} />
            <span>Undo</span>
          </button>
          <button
            type="button"
            className="toolbar-btn toolbar-history-btn"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y / Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <RedoIcon size={14} />
            <span>Redo</span>
          </button>
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
          <MagnetIcon size={14} className="toolbar-snap-icon" />
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
            <MinusIcon size={12} />
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
            <PlusIcon size={12} />
          </button>
          <span
            className="toolbar-zoom-level toolbar-zoom-value"
            data-zoom={zoom}
            title={`Current zoom level: ${formatZoom(zoom)}`}
          >
            {formatZoom(zoom)}
          </span>
        </div>

        {/* Clean Full Preview Button */}
        <button
          type="button"
          className="toolbar-btn toolbar-preview-btn"
          onClick={handlePreviewSaved}
          disabled={clipsCount === 0}
          title={
            clipsCount === 0
              ? 'Upload media to the timeline to preview'
              : 'Play clean full-screen preview from the start'
          }
        >
          <PlayIcon size={13} />
          <span>Preview</span>
        </button>

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
          <DownloadIcon size={14} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
}

export { Toolbar };
