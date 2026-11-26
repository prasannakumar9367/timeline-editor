/* ─────────────────────────────────────────────
 *  Core type definitions for the Timeline Editor
 * ───────────────────────────────────────────── */

export type MediaType = 'video' | 'audio' | 'image' | 'text';

export type TransitionType = 'fade' | 'slide-left' | 'slide-right' | 'zoom' | 'wipe';

export interface ClipTransition {
  type: TransitionType;
  duration: number; // seconds (e.g. 0.5)
}

/** An uploaded media asset in the library. */
export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  file: File;
  url: string;            // Object URL for playback / display
  duration: number;       // seconds  (images default to 5 s)
  thumbnail: string;      // data-URL preview
  waveform?: number[];    // normalized amplitude peaks (0–1) for audio clips
  width?: number;
  height?: number;
}

/** A horizontal lane on the timeline. */
export type TrackType = 'video' | 'audio' | 'image' | 'text' | 'overlay';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  icon: string;
  muted: boolean;
  locked: boolean;
}

/** A clip placed on a track. */
export interface TimelineClip {
  id: string;
  trackId: string;
  mediaId: string;
  mediaType: MediaType;
  startTime: number;      // position on the timeline (s)
  duration: number;       // visible duration (s)
  trimStart: number;      // offset into source media (s)
  volume: number;         // 0 – 1
  opacity: number;        // 0 – 1
  label: string;
  color: string;
  thumbnail: string;      // data-URL for the clip chip

  /* Subtitle / Text clip fields */
  text?: string;
  fontSize?: number;      // px (default 32)
  textColor?: string;     // hex (default '#ffffff')
  textBgColor?: string;   // hex (default '#000000')
  textPosition?: 'top' | 'center' | 'bottom';
  textX?: number;         // horizontal center position in % (0 – 100, default 50)
  textY?: number;         // vertical center position in % (0 – 100)

  /* Crop insets in % of preview frame (0 – 45 per edge) */
  cropTop?: number;
  cropRight?: number;
  cropBottom?: number;
  cropLeft?: number;

  /* Transform / Size & Position in preview (video & image clips) */
  scale?: number;         // 0.1 – 3.0 (default 1)
  posX?: number;          // horizontal offset in % (-100 – 100, default 0)
  posY?: number;          // vertical offset in % (-100 – 100, default 0)

  /* Incoming transition at the start of this clip */
  transitionIn?: ClipTransition;

  /* Text-to-Speech (TTS) audio clip fields */
  ttsText?: string;
  ttsVoice?: string;
  ttsRate?: number;
  ttsPitch?: number;
}

/** Transient state while the user is dragging something. */
export interface DragContext {
  type: 'move' | 'trim-left' | 'trim-right';
  clipId: string;
  startMouseX: number;
  startValue: number;     // startTime  for move,  trimStart  for trim-left,  duration for trim-right
  startDuration: number;
  startTrimStart: number;
  startStartTime: number;
}

/** Data attached to a drag-from-library event. */
export interface LibraryDragData {
  mediaId: string;
}
