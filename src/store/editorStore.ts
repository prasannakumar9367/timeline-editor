import { create } from 'zustand';
import type { MediaItem, Track, TimelineClip, MediaType } from '../types/editor';
import { generateThumbnail, getMediaDuration, getMediaType } from '../utils/media';
import { snapToGrid } from '../utils/time';
import { saveProjectToDB, loadProjectFromDB, clearProjectInDB } from '../utils/projectStorage';

/* ── Colour palette for new clips ── */
const CLIP_COLORS = [
  '#e33529', '#2b52d9', '#f2a900', '#16a34a',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6',
];
let colorIdx = 0;
const nextColor = () => CLIP_COLORS[colorIdx++ % CLIP_COLORS.length];

/* ── Default tracks ── */
const DEFAULT_TRACKS: Track[] = [
  { id: 'video-1', name: 'Video', type: 'video', icon: '🎬', muted: false, locked: false },
  { id: 'audio-1', name: 'Audio', type: 'audio', icon: '🎙️', muted: false, locked: false },
  { id: 'image-1', name: 'Image', type: 'image', icon: '🖼️', muted: false, locked: false },
  { id: 'text-1',  name: 'Text',  type: 'text',  icon: '💬', muted: false, locked: false },
];

/* ── History snapshot for Undo / Redo ── */
export interface HistorySnapshot {
  tracks: Track[];
  clips: TimelineClip[];
  selectedClipId: string | null;
}

const MAX_HISTORY = 50;

function createSnapshot(state: Pick<EditorState, 'tracks' | 'clips' | 'selectedClipId'>): HistorySnapshot {
  return {
    tracks: state.tracks.map((t) => ({ ...t })),
    clips: state.clips.map((c) => ({ ...c })),
    selectedClipId: state.selectedClipId,
  };
}

function pushSnapshot(
  past: HistorySnapshot[],
  state: Pick<EditorState, 'tracks' | 'clips' | 'selectedClipId'>,
): HistorySnapshot[] {
  const next = [...past, createSnapshot(state)];
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
}

/* ── State shape ── */
export interface EditorState {
  /* Media library */
  mediaItems: MediaItem[];
  isUploading: boolean;

  /* Timeline */
  tracks: Track[];
  clips: TimelineClip[];

  /* History (Undo / Redo) */
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  /* Playback */
  currentTime: number;
  duration: number;
  isPlaying: boolean;

  /* View */
  zoom: number;            // 1 = default
  scrollX: number;         // px offset
  pixelsPerSecond: number;  // derived: 80 * zoom

  /* Selection */
  selectedClipId: string | null;
  selectedMediaId: string | null;

  /* Snap */
  snapEnabled: boolean;

  /* Persistence & Export UI */
  isSaving: boolean;
  lastSavedAt: number | null;
  isExportModalOpen: boolean;

  /* ── Actions ── */
  recordHistory: () => void;
  undo: () => void;
  redo: () => void;

  saveProject: () => Promise<void>;
  loadSavedProject: () => Promise<boolean>;
  resetProject: () => Promise<void>;
  openExportModal: () => void;
  closeExportModal: () => void;
  addMedia: (files: FileList | File[]) => Promise<void>;
  removeMedia: (id: string) => void;
  selectMedia: (id: string | null) => void;

  addClip: (mediaId: string, trackId?: string, startTime?: number) => void;
  addSubtitle: (text?: string, startTime?: number, duration?: number) => void;
  moveClip: (clipId: string, startTime: number, trackId?: string) => void;
  trimClipStart: (clipId: string, newStartTime: number, newTrimStart: number, newDuration: number) => void;
  trimClipEnd: (clipId: string, newDuration: number) => void;
  deleteClip: (clipId: string) => void;
  duplicateClip: (clipId: string) => void;
  selectClip: (clipId: string | null) => void;
  updateClip: (
    clipId: string,
    updates: Partial<TimelineClip>,
    options?: { recordHistory?: boolean },
  ) => void;

  setCurrentTime: (t: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;

  setZoom: (z: number) => void;
  setScrollX: (x: number) => void;

  toggleTrackMute: (id: string) => void;
  toggleTrackLock: (id: string) => void;
  addTrack: (type: 'video' | 'audio' | 'image' | 'text') => void;
  removeTrack: (id: string) => void;

  toggleSnap: () => void;
  recalcDuration: () => void;
}

/* ── Helper to resolve best track for media type ── */
function getTrackForType(type: MediaType, tracks: Track[]): string {
  if (type === 'audio') {
    return tracks.find((t) => t.type === 'audio')?.id ?? tracks[0]?.id;
  }
  if (type === 'image') {
    return (
      tracks.find((t) => t.type === 'image')?.id ??
      tracks.find((t) => t.type === 'overlay')?.id ??
      tracks.find((t) => t.type === 'video')?.id ??
      tracks[0]?.id
    );
  }
  if (type === 'text') {
    return (
      tracks.find((t) => t.type === 'text')?.id ??
      tracks.find((t) => t.type === 'overlay')?.id ??
      tracks.find((t) => t.type === 'video')?.id ??
      tracks[0]?.id
    );
  }
  return tracks.find((t) => t.type === 'video')?.id ?? tracks[0]?.id;
}

/* ── Store ── */
export const useEditorStore = create<EditorState>((set, get) => ({
  /* ── Initial state ── */
  mediaItems: [],
  isUploading: false,
  tracks: DEFAULT_TRACKS,
  clips: [],
  past: [],
  future: [],
  currentTime: 0,
  duration: 30,
  isPlaying: false,
  zoom: 1,
  scrollX: 0,
  pixelsPerSecond: 80,
  selectedClipId: null,
  selectedMediaId: null,
  snapEnabled: true,
  isSaving: false,
  lastSavedAt: null,
  isExportModalOpen: false,

  /* ── History (Undo / Redo) ── */
  recordHistory: () =>
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
    })),

  undo: () => {
    const { past, future, tracks, clips, selectedClipId } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const nextPast = past.slice(0, -1);
    const currentSnapshot = createSnapshot({ tracks, clips, selectedClipId });
    set({
      tracks: previous.tracks,
      clips: previous.clips,
      selectedClipId: previous.selectedClipId,
      past: nextPast,
      future: [...future, currentSnapshot],
    });
    get().recalcDuration();
  },

  redo: () => {
    const { past, future, tracks, clips, selectedClipId } = get();
    if (future.length === 0) return;
    const next = future[future.length - 1];
    const nextFuture = future.slice(0, -1);
    const currentSnapshot = createSnapshot({ tracks, clips, selectedClipId });
    set({
      tracks: next.tracks,
      clips: next.clips,
      selectedClipId: next.selectedClipId,
      past: [...past, currentSnapshot].slice(-MAX_HISTORY),
      future: nextFuture,
    });
    get().recalcDuration();
  },

  /* ── Persistence & Export UI ── */
  saveProject: async () => {
    set({ isSaving: true });
    try {
      const { tracks, clips, mediaItems, zoom, snapEnabled, duration } = get();
      const storedMedia = mediaItems.map(({ url: _url, ...rest }) => rest);
      const savedAt = await saveProjectToDB({
        tracks,
        clips,
        mediaItems: storedMedia,
        zoom,
        snapEnabled,
        duration,
      });
      set({ lastSavedAt: savedAt, isSaving: false });
    } catch (err) {
      console.error('Failed to save project:', err);
      set({ isSaving: false });
    }
  },

  loadSavedProject: async () => {
    try {
      const saved = await loadProjectFromDB();
      if (!saved) return false;
      const loadedTracks = saved.tracks.length > 0 ? saved.tracks : DEFAULT_TRACKS;
      const trackIdSet = new Set(loadedTracks.map((t) => t.id));
      const validClips = saved.clips.filter((c) => trackIdSet.has(c.trackId));
      set({
        tracks: loadedTracks,
        clips: validClips,
        mediaItems: saved.mediaItems,
        past: [],
        future: [],
        zoom: saved.zoom,
        pixelsPerSecond: 80 * saved.zoom,
        snapEnabled: saved.snapEnabled,
        duration: saved.duration,
        lastSavedAt: saved.savedAt,
        currentTime: 0,
        isPlaying: false,
        selectedClipId: validClips[0]?.id ?? null,
        selectedMediaId: saved.mediaItems[0]?.id ?? null,
      });
      get().recalcDuration();
      return true;
    } catch (err) {
      console.error('Failed to load saved project:', err);
      return false;
    }
  },

  resetProject: async () => {
    try {
      await clearProjectInDB();
    } catch (err) {
      console.warn('Failed to clear IndexedDB:', err);
    }
    for (const m of get().mediaItems) {
      URL.revokeObjectURL(m.url);
    }
    set({
      mediaItems: [],
      tracks: DEFAULT_TRACKS,
      clips: [],
      past: [],
      future: [],
      currentTime: 0,
      duration: 30,
      isPlaying: false,
      zoom: 1,
      pixelsPerSecond: 80,
      selectedClipId: null,
      selectedMediaId: null,
      lastSavedAt: null,
    });
  },

  openExportModal: () => set({ isExportModalOpen: true, isPlaying: false }),
  closeExportModal: () => set({ isExportModalOpen: false }),

  /* ── Media library ── */
  addMedia: async (files) => {
    set({ isUploading: true });
    const incoming: MediaItem[] = [];

    for (const file of Array.from(files)) {
      try {
        const type = getMediaType(file);
        const url = URL.createObjectURL(file);
        const [thumbnail, duration] = await Promise.all([
          generateThumbnail(file, type),
          getMediaDuration(file, type),
        ]);
        incoming.push({
          id: crypto.randomUUID(),
          name: file.name,
          type,
          file,
          url,
          duration,
          thumbnail,
        });
      } catch (err) {
        console.warn('Failed to process', file.name, err);
      }
    }

    if (incoming.length === 0) {
      set({ isUploading: false });
      return;
    }

    const { clips, tracks } = get();

    // If no clips exist on timeline, automatically place the first uploaded media
    // onto the timeline at 0s so it immediately appears in the preview and plays!
    const newClips: TimelineClip[] = [];
    if (clips.length === 0) {
      let cumulativeStart = 0;
      for (const item of incoming) {
        const trackId = getTrackForType(item.type, tracks);
        const dur = item.type === 'image' ? 5 : item.duration;
        newClips.push({
          id: crypto.randomUUID(),
          trackId,
          mediaId: item.id,
          mediaType: item.type,
          startTime: cumulativeStart,
          duration: dur,
          trimStart: 0,
          volume: 1,
          opacity: 1,
          label: item.name.replace(/\.[^.]+$/, ''),
          color: nextColor(),
          thumbnail: item.thumbnail,
        });
        cumulativeStart += dur;
      }
    }

    set((s) => ({
      mediaItems: [...s.mediaItems, ...incoming],
      clips: newClips.length > 0 ? [...s.clips, ...newClips] : s.clips,
      past: newClips.length > 0 ? pushSnapshot(s.past, s) : s.past,
      future: newClips.length > 0 ? [] : s.future,
      selectedClipId: newClips.length > 0 ? newClips[0].id : s.selectedClipId,
      selectedMediaId: incoming[0].id,
      isUploading: false,
    }));

    get().recalcDuration();
  },

  removeMedia: (id) =>
    set((s) => {
      const hadClips = s.clips.some((c) => c.mediaId === id);
      return {
        mediaItems: s.mediaItems.filter((m) => m.id !== id),
        clips: s.clips.filter((c) => c.mediaId !== id),
        past: hadClips ? pushSnapshot(s.past, s) : s.past,
        future: hadClips ? [] : s.future,
        selectedMediaId: s.selectedMediaId === id ? null : s.selectedMediaId,
      };
    }),

  selectMedia: (id) => set({ selectedMediaId: id }),

  /* ── Clips ── */
  addClip: (mediaId, trackId, startTime) => {
    const media = get().mediaItems.find((m) => m.id === mediaId);
    if (!media) return;

    const tracks = get().tracks;
    const targetTrackId = trackId || getTrackForType(media.type, tracks);
    const targetStartTime =
      startTime !== undefined ? Math.max(0, startTime) : get().currentTime;

    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      trackId: targetTrackId,
      mediaId,
      mediaType: media.type,
      startTime: targetStartTime,
      duration: media.type === 'image' ? 5 : media.duration,
      trimStart: 0,
      volume: 1,
      opacity: 1,
      label: media.name.replace(/\.[^.]+$/, ''),
      color: nextColor(),
      thumbnail: media.thumbnail,
    };

    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
    }));
    get().recalcDuration();
  },

  addSubtitle: (text = 'New Subtitle', startTime, duration = 3) => {
    const tracks = get().tracks;
    const targetTrackId = getTrackForType('text', tracks);
    if (!targetTrackId) return;

    const targetStartTime =
      startTime !== undefined ? Math.max(0, startTime) : get().currentTime;

    const clip: TimelineClip = {
      id: crypto.randomUUID(),
      trackId: targetTrackId,
      mediaId: 'subtitle',
      mediaType: 'text',
      startTime: targetStartTime,
      duration: Math.max(0.5, duration),
      trimStart: 0,
      volume: 1,
      opacity: 1,
      label: text.slice(0, 24) || 'Subtitle',
      color: '#f97316',
      thumbnail: '',
      text,
      fontSize: 32,
      textColor: '#ffffff',
      textBgColor: '#000000',
      textPosition: 'bottom',
      textX: 50,
      textY: 86,
    };

    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      clips: [...s.clips, clip],
      selectedClipId: clip.id,
    }));
    get().recalcDuration();
  },

  moveClip: (clipId, startTime, trackId) => {
    let t = Math.max(0, startTime);
    const { clips, snapEnabled } = get();

    if (snapEnabled) {
      t = snapToGrid(t, 0.25);
      // snap to neighbours
      for (const c of clips) {
        if (c.id === clipId) continue;
        const end = c.startTime + c.duration;
        if (Math.abs(t - c.startTime) < 0.2) { t = c.startTime; break; }
        if (Math.abs(t - end) < 0.2) { t = end; break; }
      }
    }

    set({
      clips: clips.map((c) =>
        c.id === clipId ? { ...c, startTime: t, ...(trackId ? { trackId } : {}) } : c,
      ),
    });
    get().recalcDuration();
  },

  trimClipStart: (clipId, newStartTime, newTrimStart, newDuration) => {
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId
          ? {
              ...c,
              startTime: Math.max(0, newStartTime),
              trimStart: Math.max(0, newTrimStart),
              duration: Math.max(0.25, newDuration),
            }
          : c,
      ),
    }));
    get().recalcDuration();
  },

  trimClipEnd: (clipId, newDuration) => {
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === clipId ? { ...c, duration: Math.max(0.25, newDuration) } : c,
      ),
    }));
    get().recalcDuration();
  },

  deleteClip: (clipId) => {
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      clips: s.clips.filter((c) => c.id !== clipId),
      selectedClipId: s.selectedClipId === clipId ? null : s.selectedClipId,
    }));
    get().recalcDuration();
  },

  duplicateClip: (clipId) => {
    const clip = get().clips.find((c) => c.id === clipId);
    if (!clip) return;
    const dup: TimelineClip = {
      ...clip,
      id: crypto.randomUUID(),
      startTime: clip.startTime + clip.duration + 0.1,
      color: nextColor(),
    };
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      clips: [...s.clips, dup],
      selectedClipId: dup.id,
    }));
    get().recalcDuration();
  },

  selectClip: (id) => set({ selectedClipId: id }),

  updateClip: (clipId, updates, options) => {
    const shouldRecord = options?.recordHistory ?? true;
    set((s) => ({
      ...(shouldRecord ? { past: pushSnapshot(s.past, s), future: [] } : {}),
      clips: s.clips.map((c) => (c.id === clipId ? { ...c, ...updates } : c)),
    }));
    if (updates.startTime !== undefined || updates.duration !== undefined) {
      get().recalcDuration();
    }
  },

  /* ── Playback ── */
  setCurrentTime: (t) => set({ currentTime: Math.max(0, t) }),
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),
  stop: () => set({ isPlaying: false, currentTime: 0 }),

  /* ── View ── */
  setZoom: (z) => {
    const clamped = Math.max(0.25, Math.min(6, z));
    set({ zoom: clamped, pixelsPerSecond: 80 * clamped });
  },
  setScrollX: (x) => set({ scrollX: Math.max(0, x) }),

  /* ── Tracks ── */
  toggleTrackMute: (id) =>
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)),
    })),
  toggleTrackLock: (id) =>
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      tracks: s.tracks.map((t) => (t.id === id ? { ...t, locked: !t.locked } : t)),
    })),

  addTrack: (type) => {
    const { tracks } = get();
    const count = tracks.filter((t) => t.type === type).length + 1;
    const icons = { video: '🎬', audio: '🎙️', image: '🖼️', text: '💬' };
    const baseNames = { video: 'Video', audio: 'Audio', image: 'Image', text: 'Text' };
    const name = count === 1 ? baseNames[type] : `${baseNames[type]} ${count}`;
    const track: Track = {
      id: `${type}-${Date.now()}`,
      name,
      type,
      icon: icons[type],
      muted: false,
      locked: false,
    };
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      tracks: [...s.tracks, track],
    }));
  },

  removeTrack: (id) =>
    set((s) => ({
      past: pushSnapshot(s.past, s),
      future: [],
      tracks: s.tracks.filter((t) => t.id !== id),
      clips: s.clips.filter((c) => c.trackId !== id),
    })),

  /* ── Snap ── */
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),

  /* ── Recalculate total duration ── */
  recalcDuration: () => {
    const { clips } = get();
    if (clips.length === 0) { set({ duration: 30 }); return; }
    const maxEnd = Math.max(...clips.map((c) => c.startTime + c.duration));
    set({ duration: Math.max(30, maxEnd + 10) });
  },
}));
