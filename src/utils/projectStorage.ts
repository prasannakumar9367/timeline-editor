import type { MediaItem, Track, TimelineClip } from '../types/editor';

const DB_NAME = 'TimelineEditorDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const DEFAULT_PROJECT_KEY = 'autosave';

export interface StoredMediaItem {
  id: string;
  name: string;
  type: MediaItem['type'];
  file: File;
  duration: number;
  thumbnail: string;
  width?: number;
  height?: number;
}

export interface StoredProject {
  tracks: Track[];
  clips: TimelineClip[];
  mediaItems: StoredMediaItem[];
  zoom: number;
  snapEnabled: boolean;
  duration: number;
  savedAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Save the full editor state including File blobs into IndexedDB. */
export async function saveProjectToDB(project: Omit<StoredProject, 'savedAt'>): Promise<number> {
  const db = await openDB();
  const savedAt = Date.now();
  const payload: StoredProject = { ...project, savedAt };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(payload, DEFAULT_PROJECT_KEY);
    req.onsuccess = () => resolve(savedAt);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** Load the saved project from IndexedDB and recreate Object URLs for media files. */
export async function loadProjectFromDB(): Promise<
  (Omit<StoredProject, 'mediaItems'> & { mediaItems: MediaItem[] }) | null
> {
  const db = await openDB();

  const raw = await new Promise<StoredProject | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(DEFAULT_PROJECT_KEY);
    req.onsuccess = () => resolve(req.result as StoredProject | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });

  if (!raw) return null;

  const hydratedMedia: MediaItem[] = raw.mediaItems.map((m) => ({
    ...m,
    url: URL.createObjectURL(m.file),
  }));

  return {
    ...raw,
    mediaItems: hydratedMedia,
  };
}

/** Clear the saved project from IndexedDB. */
export async function clearProjectInDB(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(DEFAULT_PROJECT_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}
