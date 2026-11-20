import React, { useRef, useState } from 'react';
import { useEditorStore } from '../../store/editorStore';
import type { MediaItem, MediaType, LibraryDragData } from '../../types/editor';
import { formatTime } from '../../utils/time';
import './MediaLibrary.css';

const TYPE_ICONS: Record<MediaType, string> = {
  video: '🎬',
  audio: '🎙️',
  image: '🖼️',
  text: '💬',
};

const ACCEPTED_FORMATS_TEXT = 'MP4, WebM, MOV • MP3, WAV • PNG, JPG, GIF, WebP';
const ACCEPTED_MIME_TYPES = 'video/*,audio/*,image/*';

export default function MediaLibrary(): React.JSX.Element {
  const {
    mediaItems,
    selectedMediaId,
    isUploading,
    addMedia,
    addClip,
    removeMedia,
    selectMedia,
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef<number>(0);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const handleImportClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (e.target.files && e.target.files.length > 0) {
      void addMedia(e.target.files);
      e.target.value = '';
    }
  };

  const isFileDragEvent = (e: React.DragEvent): boolean => {
    return Array.from(e.dataTransfer.types).includes('Files');
  };

  const handleDragEnter = (e: React.DragEvent<HTMLElement>): void => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>): void => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: React.DragEvent<HTMLElement>): void => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>): void => {
    if (!isFileDragEvent(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addMedia(e.dataTransfer.files);
    }
  };

  const handleCardDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    item: MediaItem,
  ): void => {
    const payload: LibraryDragData = { mediaId: item.id };
    const serialized = JSON.stringify(payload);
    e.dataTransfer.setData('application/json', serialized);
    e.dataTransfer.setData('text/plain', serialized);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCardContextMenu = (
    e: React.MouseEvent<HTMLDivElement>,
    itemId: string,
  ): void => {
    e.preventDefault();
    e.stopPropagation();
    removeMedia(itemId);
  };

  const handleDeleteButtonClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    itemId: string,
  ): void => {
    e.stopPropagation();
    removeMedia(itemId);
  };

  const handleAddButtonClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    itemId: string,
  ): void => {
    e.stopPropagation();
    addClip(itemId);
  };

  const hasItems = mediaItems.length > 0;

  return (
    <aside
      className={`media-lib-panel ${isDragOver ? 'media-lib-panel-dragover' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      aria-label="Media Library"
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_MIME_TYPES}
        onChange={handleFileInputChange}
        className="media-lib-file-input"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Header */}
      <header className="media-lib-header">
        <div className="media-lib-title-row">
          <h2 className="media-lib-title">Media Library</h2>
          {hasItems && (
            <span className="media-lib-count-badge">{mediaItems.length}</span>
          )}
        </div>
        <button
          type="button"
          className="media-lib-import-btn"
          onClick={handleImportClick}
          disabled={isUploading}
          title="Import media files from your computer"
        >
          <span className="media-lib-import-icon">📁</span>
          <span>Import</span>
        </button>
      </header>

      {/* Uploading indicator */}
      {isUploading && (
        <div className="media-lib-uploading-banner" role="status" aria-live="polite">
          <div className="media-lib-spinner" />
          <span className="media-lib-uploading-text">Processing media…</span>
        </div>
      )}

      {/* Content Area */}
      <div className="media-lib-content">
        {!hasItems && !isUploading ? (
          /* Empty State Dropzone */
          <div
            className="media-lib-dropzone"
            onClick={handleImportClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleImportClick();
              }
            }}
          >
            <div className="media-lib-dropzone-icon">📥</div>
            <p className="media-lib-dropzone-prompt">Drop media files here</p>
            <p className="media-lib-dropzone-formats">
              Accepted formats:
              <br />
              {ACCEPTED_FORMATS_TEXT}
            </p>
            <button
              type="button"
              className="media-lib-dropzone-browse-btn"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                handleImportClick();
              }}
            >
              Browse Files
            </button>
          </div>
        ) : (
          /* Media Grid */
          <div className="media-lib-grid" role="list" aria-label="Media items">
            {mediaItems.map((item) => {
              const isSelected = selectedMediaId === item.id;
              return (
                <div
                  key={item.id}
                  className={`media-lib-card ${isSelected ? 'media-lib-card-selected' : ''}`}
                  draggable={true}
                  onDragStart={(e) => handleCardDragStart(e, item)}
                  onClick={() => selectMedia(item.id)}
                  onDoubleClick={() => addClip(item.id)}
                  onContextMenu={(e) => handleCardContextMenu(e, item.id)}
                  tabIndex={0}
                  role="listitem"
                  title={`${item.name} (Double-click or click + to add to timeline, drag to track, or ✕ to remove)`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectMedia(item.id);
                    } else if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      removeMedia(item.id);
                    }
                  }}
                >
                  {/* Thumbnail & Badges */}
                  <div className="media-lib-thumbnail-wrapper">
                    <img
                      src={item.thumbnail}
                      alt={item.name}
                      className="media-lib-thumbnail-img"
                      draggable={false}
                      loading="lazy"
                    />

                    {/* Type icon badge */}
                    <span
                      className="media-lib-type-badge"
                      title={item.type}
                      aria-label={item.type}
                    >
                      {TYPE_ICONS[item.type] ?? '🎬'}
                    </span>

                    {/* Duration badge */}
                    <span className="media-lib-duration-badge">
                      {formatTime(item.duration)}
                    </span>

                    {/* Quick Add button */}
                    <button
                      type="button"
                      className="media-lib-add-btn"
                      onClick={(e) => handleAddButtonClick(e, item.id)}
                      title="Add to timeline at playhead"
                      aria-label={`Add ${item.name} to timeline`}
                    >
                      + Add
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      className="media-lib-delete-btn"
                      onClick={(e) => handleDeleteButtonClick(e, item.id)}
                      title="Remove from library"
                      aria-label={`Remove ${item.name}`}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Filename */}
                  <div className="media-lib-info">
                    <span className="media-lib-filename" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
