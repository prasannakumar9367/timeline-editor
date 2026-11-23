# Timeline Editor

A browser-based, multi-track video and audio timeline editor built with **React**, **TypeScript**, **Vite**, and **Zustand**. Everything runs client-side in the browser — including real-time media playback, Web Audio waveform rendering, draggable text overlays, local project persistence via IndexedDB, and MP4/WebM video export via HTML5 Canvas and `MediaRecorder`.

---

## Features

- **Multi-Track Timeline**
  - Clean default tracks for **Video**, **Audio**, **Image**, and **Text**, with support for adding/removing tracks, muting, and locking.
  - Drag clips to reposition, trim start/end edges via resize handles, duplicate, or delete.
  - Zoomable timeline (`0.25x` – `6x`) with a scrubbable time ruler and playhead.
  - **Magnetic Snap** (`0.25s` grid alignment + `0.2s` magnetic edge snapping to adjacent clips) that can be toggled on/off for freeform placement.
- **Real Audio Waveforms**
  - Decodes imported audio files with the Web Audio API (`decodeAudioData`) and renders high-DPI mirrored waveforms directly inside audio clips.
  - Waveforms dynamically slice when trimming, adapt to timeline zoom, and scale visually with clip volume.
- **Live 16:9 Preview Monitor**
  - Real-time layered compositing (`Video` → `Image` → `Text`) synchronized with the timeline playhead and a rolling 30-frame FPS HUD.
  - **Selected Clip Highlighting**: Active selected clips are framed in the preview with an accent highlight border, corner markers, and a selection badge.
  - **Draggable Text / Subtitles**: Click and drag subtitle overlays directly in the preview monitor to place them anywhere (stored as responsive `%` coordinates that stay consistent across preview and export).
- **Properties Inspector**
  - Edit clip label, color, start time, duration, volume, and opacity.
  - Customize subtitle text, font size, text/background colors, and quick position presets (`Top`, `Center`, `Bottom`) with live `X%, Y%` coordinate readout.
- **Undo / Redo History**
  - 50-step undo/redo stack with toolbar buttons and keyboard shortcuts, batching continuous drags, trims, and slider adjustments into single history entries.
- **Media Library**
  - Drag-and-drop or browse to import videos (`MP4`, `WebM`, `MOV`), audio (`MP3`, `WAV`, `OGG`, `AAC`, `FLAC`), and images (`PNG`, `JPG`, `GIF`, `WebP`, `SVG`) with automatic thumbnail and duration extraction.
- **Local Save & Video Export**
  - Save and restore projects (including media files, clips, tracks, and waveforms) locally in the browser using **IndexedDB**.
  - Export the full timeline or a custom time range as **MP4** or **WebM** (`720p` / `1080p`, `30` / `60` FPS) with mixed Web Audio.

---

## Tech Stack

- **UI & Language**: React 19, TypeScript, Vite
- **State Management**: Zustand
- **Browser APIs**: HTML5 Canvas, Web Audio API (`AudioContext` / `decodeAudioData`), `MediaRecorder`, `requestAnimationFrame`, IndexedDB

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm

### Installation & Development

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

### Other Scripts

```bash
# Type-check and build for production
npm run build

# Preview the production build locally
npm run preview

# Run ESLint
npm run lint
```

---

## Keyboard Shortcuts

| Shortcut                                        | Action                               |
| ----------------------------------------------- | ------------------------------------ |
| `Space`                                       | Play / Pause                         |
| `Ctrl+Z` / `Cmd+Z`                          | Undo                                 |
| `Ctrl+Y` / `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo                                 |
| `Delete` / `Backspace`                      | Delete selected clip                 |
| `Ctrl+D` / `Cmd+D`                          | Duplicate selected clip              |
| `Ctrl+S` / `Cmd+S`                          | Toggle Snap to Grid                  |
| `Home`                                        | Jump playhead to start (`00:00.0`) |
| `.` (Period)                                  | Stop and reset playhead to start     |
| `Escape`                                      | Deselect current clip                |

---

## Project Structure

```text
src/
├── components/
│   ├── Editor/           # Main editor layout shell
│   ├── ExportModal/      # Video export configuration & progress modal
│   ├── Icons/            # Unified SVG icon set
│   ├── MediaLibrary/     # File import dropzone & media asset grid
│   ├── Preview/          # 16:9 preview monitor, clip highlight & draggable text
│   ├── PropertiesPanel/  # Clip & subtitle inspector panel
│   ├── Timeline/         # Multi-track lanes, ruler, clips & AudioWaveform canvas
│   └── Toolbar/          # Top bar (save, subtitle, undo/redo, playback, FPS, snap, zoom, export)
├── hooks/
│   ├── useKeyboard.ts    # Global editor keyboard shortcuts
│   └── usePlayback.ts    # requestAnimationFrame playback clock & FPS counter
├── store/
│   └── editorStore.ts    # Zustand store (clips, tracks, undo/redo history, persistence)
├── types/
│   └── editor.ts         # Core TypeScript interfaces
└── utils/
    ├── exporter.ts       # Canvas + Web Audio + MediaRecorder video exporter
    ├── media.ts          # Thumbnail, duration & audio waveform extraction
    ├── projectStorage.ts # IndexedDB project persistence
    └── time.ts           # Timecode formatting & grid snapping helpers
```
